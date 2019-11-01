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

Value : (Bearer ) Ctrl+Space해서 (firebase Token)을 누르고 firebase_API_Key와 providerId, token종류를 입력한다.

![img2](./screenShot/img2.png)
![img3](./screenShot/img3.png)

1번 로그인 API를 제외하고 Auth 설정은 하지 않는다.


## 제안사항
OAuth 2.0의 google 계정만 가능하다.
Auth2탭에서 refresh token이 존재하지 않으면 1시간 후에 만료가 되버린다.