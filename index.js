const axios = require('axios');


module.exports.requestHooks = [
    async context => {
        const auth = context.request.getAuthentication();

        //auth의 있을 경우만 실행
        if (Object.keys(auth).length === 0) {
            return;
        }

        await context.store.clear();
        const addItem1 = context.store.setItem('authId', context.request.getId());
        const addItem2 = context.store.setItem('clientId', auth.clientId);
        const addItem3 = context.store.setItem('clientSecret', auth.clientSecret);
        const addItem4 = context.store.setItem('redirectUrl', auth.redirectUrl);

        await Promise.all([addItem1, addItem2, addItem3, addItem4]);

    }
];

module.exports.templateTags = [{
    name: 'firebaseOuthToken',
    displayName: 'firebase-token',
    description: "get firebase ID token by google OAuth2, or oauth2 access token refreshed",
    args: [{
            displayName: 'firebase API Key',
            type: 'string',
            help: 'use refresh token or authorization at first time'
        },
        {
            displayName: 'providerId',
            type: 'enum',
            options: [{
                displayName: 'google',
                value: 'google.com',
            }, ]
        }, {
            displayName: 'idToken or acceess Token',
            type: 'enum',
            options: [{
                displayName: 'firebase idToken',
                value: 1,
            }, {
                displayName: 'Google Oauth2 access token',
                value: 0,
            }]
        }
    ],

    async run(context, key, id, isIdToken) {
        if (!key) {
            throw new Error('undefined firebase api key');
        }
        if (!id) {
            throw new Error('undefined ProviderID');
        }

        //이미 저장된 id토큰이 존재하면 새로 만들지 않고 그대로 반환한다.
        if (await context.store.hasItem('accessToken')) {
            let accessToken = await context.store.getItem('accessToken');

            if (await context.store.hasItem('idToken')) { //id토큰이 존재

                //if access Token is expired, refresh token
                //access token window don't change in insomnia program auth tab, but change access token
                if (await expiredAccessToken(accessToken)) {

                    if (!(await context.store.hasItem('refreshToken'))) {
                        throw new Error('expired oAuth2Token');
                    }

                    return await refreshToken(context, key, id, isIdToken);
                }

                if (isIdToken == 1) {
                    return await context.store.getItem('idToken');
                }

                return accessToken;

            }
        }

        //첫 호출시 access token을 인증한다
        const authId = await context.store.getItem('authId');
        if (!authId) {
            throw new Error('do not send Login API And fetch access token');
        }

        const token = await context.util.models.oAuth2Token.getByRequestId(authId);
        if (!token) {
            throw new Error('invalided oAuth2Token');
        }

        await context.store.setItem('accessToken', token.accessToken);

        if (token.refreshToken) {
            await context.store.setItem('refreshToken', token.refreshToken);
        }
        const redirectUrl = await context.store.getItem('redirectUrl');
        const accessToken = token.accessToken;

        if (!accessToken) {
            throw new Error('not exist accessToken');
        }

        try {

            const idToken = await getFirebaseIdToken(accessToken, key, id, redirectUrl);
            await context.store.setItem('idToken', idToken);
            
            return isIdToken == 1 ? idToken : accessToken;

        } catch (e) {
            console.log(e);
            throw new Error('invalid APIKey or providerId');
        }
    }
}];

//access token 만료 여부를 구하는 메소드
async function expiredAccessToken(accessToken) {
    try {
        await axios.post(`https://www.googleapis.com/oauth2/v1/tokeninfo?access_token=${accessToken}`);
        return false;
    } catch {
        return true;
    }
}

//refresh된 access token을 반환하는 메소드
async function getRefreshedAccessToken(refreshToken, clientId, clientSecret) {

    const param = {
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
        client_id: clientId,
        client_secret: clientSecret
    };

    try {
        const token = await axios.post('https://www.googleapis.com/oauth2/v4/token', param);
        return token.data.access_token;
    } catch (err) {
        console.log(err);
    }
}


//accesstoken을 이용해서 인증하고 ID token을 반환하는 메소드
async function getFirebaseIdToken(accessToken, key, id, redirectUrl) {

    const param = {
        postBody: `access_token=${accessToken}&providerId=${id}`,
        requestUri: redirectUrl,
        returnIdpCredential: true,
        returnSecureToken: true
    }
    const firebaseToken = await axios.post(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithIdp?key=${key}`, param, {
        headers: {
            'Content-Type': 'application/json',
        }
    });
    return firebaseToken.data.idToken;

}

//Token을 refresh하는 메소드
async function refreshToken(context, key, id, isIdToken) {
    console.log('refreshed token');

    const clientId = await context.store.getItem('clientId');
    const clientSecret = await context.store.getItem('clientSecret');
    const refreshToken = await context.store.getItem('refreshToken');
    const redirectUrl = await context.store.getItem('redirectUrl');
    const accessToken = await getRefreshedAccessToken(refreshToken, clientId, clientSecret);
    const idToken = await getFirebaseIdToken(accessToken, key, id, redirectUrl);
    
    const addAccessToken = context.store.setItem('accessToken', accessToken);
    const addIdToken = context.store.setItem('idToken', idToken);
    await Promise.all([addAccessToken, addIdToken]);

    return isIdToken == 1 ? idToken : accessToken;
}