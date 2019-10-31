const axios = require('axios');

module.exports.requestHooks = [
    async context => {
        const auth = context.request.getAuthentication();
        if (Object.keys(auth).length === 0) {
            return;
        }

        const addItem1 = context.store.setItem('authId', context.request.getId());
        const addItem2 = context.store.setItem('clientId', auth.clientId);
        const addItem3 = context.store.setItem('clientSecret', auth.clientSecret);
        const addItem4 = context.store.setItem('redirectUrl', auth.redirectUrl);

        await Promise.all([addItem1, addItem2, addItem3, addItem4]);

        if (await context.store.hasItem('accessToken')) {
            await context.store.removeItem('accessToken')
        }
        if (await context.store.hasItem('idToken')) {
            await context.store.removeItem('idToken')
        }
    }
];

module.exports.templateTags = [{
    name: 'idToken',
    displayName: 'firebase idToken',
    description: "get firebase ID token using oauth2 access token",
    args: [{
            displayName: 'firebase API Key',
            type: 'string',
            help: 'refresh하거나 첫인증할 때 사용합니다.'
        },
        {
            displayName: 'providerId',
            type: 'enum',
            options: [{
                    displayName: 'google',
                    value: 'google.com',
                },
            ]
        }
    ],
    async run(context, key, id) {

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

                //access Token이 만료가 되었다면 refresh,
                //insomnia access token에 화면은 변하지 않지만 access token은 변경된다.
                if (await expiredAccessToken(accessToken)) {
                    return await refreshIdToken(context, key, id); //change
                }

                return await context.store.getItem('idToken');
            }
        }

        //첫 호출시 아이디 인증한다
        const authId = await context.store.getItem('authId');
        if (!authId) {
            throw new Error('send Login API And fetch access token');
        }

        const token = await context.util.models.oAuth2Token.getByRequestId(authId);
        if (!token) {
            throw new Error('invalided oAuth2Token');
        }

        await context.store.setItem('accessToken', token.accessToken);
        await context.store.setItem('refreshToken', token.refreshToken);
        const redirectUrl = await context.store.getItem('redirectUrl');
        const accessToken = token.accessToken;

        if (!accessToken) {
            throw new Error('not exist accessToken');
        }

        try {

            const idToken = await getFirebaseIdToken(accessToken, key, id, redirectUrl);
            await context.store.setItem('idToken', idToken);

            return idToken;

        } catch (e) {
            console.log(e);
            throw new Error('invalid APIKey or providerId');
        }
    }
}, {
    name: 'google_access_Token',
    displayName: 'google access Token',
    description: 'get google oauth2 access token refreshed',
    args: [{
            displayName: 'firebase web api Key',
            type: 'string',
            help: 'refresh하거나 첫인증할 때 사용합니다.'
        },
        {
            displayName: 'providerId',
            type: 'enum',
            options: [{
                    displayName: 'google',
                    value: 'google.com',
                },
            ]
        }
    ],

    async run(context, key, id) {
        if (!key) {
            throw new Error('undefined firebase api key');
        }
        if (!id) {
            throw new Error('undefined ProviderID');
        }

        if (await context.store.hasItem('accessToken')) {
            let accessToken = await context.store.getItem('accessToken');

            if (await context.store.hasItem('idToken')) {
                if (await expiredAccessToken(accessToken)) {
                    return await refreshAccessToken(context, key, id);
                }

                return accessToken;
            }
        }

        const authId = await context.store.getItem('authId');
        if (!authId) {
            throw new Error('send Login API And fetch access token');
        }

        const token = await context.util.models.oAuth2Token.getByRequestId(authId);
        if (!token) {
            throw new Error('invalided oAuth2Token');
        }

        const addAccessToken = await context.store.setItem('accessToken', token.accessToken);
        const addRefreshToken = await context.store.setItem('refreshToken', token.refreshToken);
        const redirectUrl = await context.store.getItem('redirectUrl');

        await Promise.all([addAccessToken, addRefreshToken, redirectUrl]);
        const accessToken = token.accessToken;

        if (!accessToken) {
            throw new Error('not exist accessToken');
        }

        try {

            const idToken = await getFirebaseIdToken(accessToken, key, id, redirectUrl);
            await context.store.setItem('idToken', idToken);
            return accessToken;
        } catch (e) {
            console.log(e);
            throw new Error('invalid APIKey or providerId');
        }
    }
}];


async function expiredAccessToken(accessToken) {

    try {
        await axios.post(`https://www.googleapis.com/oauth2/v1/tokeninfo?access_token=${accessToken}`);
        return false;
    } catch {
        return true;
    }

}

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

async function refreshIdToken(context, key, id) {
    console.log('refreshed');

    const clientId = await context.store.getItem('clientId');
    const clientSecret = await context.store.getItem('clientSecret');
    const refreshToken = await context.store.getItem('refreshToken');
    const redirectUrl = await context.store.getItem('redirectUrl');
    const accessToken = await getRefreshedAccessToken(refreshToken, clientId, clientSecret);
    const idToken = await getFirebaseIdToken(accessToken, key, id, redirectUrl);

    const addAccessToken = context.store.setItem('accessToken', accessToken);
    const addIdToken = context.store.setItem('idToken', idToken);
    await Promise.all([addAccessToken, addIdToken]);

    return idToken;
}

async function refreshAccessToken(context, key, id) {
    console.log('refreshed');

    const clientId = await context.store.getItem('clientId');
    const clientSecret = await context.store.getItem('clientSecret');
    const refreshToken = await context.store.getItem('refreshToken');
    const redirectUrl = await context.store.getItem('redirectUrl');

    const accessToken = await getRefreshedAccessToken(refreshToken, clientId, clientSecret);
    const idToken = await getFirebaseIdToken(accessToken, key, id, redirectUrl);

    const addAccessToken = context.store.setItem('accessToken', accessToken);
    const addIdToken = context.store.setItem('idToken', idToken);
    await Promise.all([addAccessToken, addIdToken]);

    return accessToken;
}