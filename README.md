## install
Application -> Prefereces -> Plugins -> Show Plugins Folder에 있는 장소에 설치

## how to

### 1. 로그인할 임시 REST API를 설정한다.


OAuth2 탭을 이용한다.

GRANT CODE : Authorization Code

AUTHORIZATION URL : [auth_url]

ACCESS TOKEN URL : [access_tokne_url]

CLIENT ID : [client_id]

CLIENT SECRET : [client_secret]

REDIRECT URL : [redirect_url]

SCOPE : https://www.googleapis.com/auth/userinfo.email https://www.googleapis.com/auth/userinfo.profile openid
![img1](./screenShot/img1.png)


### 2. Send
OAuth2 가 적용된 RSET API를 Send 한다.

### 3. 다른 REST API의 Header에 추가한다.
Key(Header Name) : Authorization

Value : (Bearer: ) Ctrl+Space해서 (firebaseidToken|googleAccessToken)을 누르고 firebase_API_Key와 providerId를 입력한다.

![img2](./screenShot/img2.png)
![img3](./screenShot/img3.png)

1번 로그인 API를 제외하고 Auth 설정은 하지 않는다.


## 제안사항
Refresh Token을 반드시 얻어야 한다.