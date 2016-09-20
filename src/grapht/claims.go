package main

import (
	"fmt"
	"time"

	jwt "github.com/dgrijalva/jwt-go"
)

type Claims map[string]interface{}

func (c Claims) User() (*User, error) {
	id, ok := c["uid"].(string)
	if !ok {
		return nil, fmt.Errorf("no uid in claims")
	}
	return users.Get(id)
}

func (c Claims) Role() (string, error) {
	role, ok := c["role"].(string)
	if !ok {
		return "", fmt.Errorf("no role in claims")
	}
	switch role {
	case AdminRole:
		return AdminRole, nil
	case GuestRole:
		return GuestRole, nil
	default:
		return "", fmt.Errorf("invalid role in claims")
	}
}

func (c Claims) App() (*App, error) {
	u, err := c.User()
	if err != nil {
		return nil, err
	}
	appID, ok := c["aid"].(string)
	if !ok {
		return nil, fmt.Errorf("no aid in claims")
	}
	role, err := c.Role()
	if err != nil {
		return nil, err
	}
	if !u.HasAppRole(appID, role) {
		return nil, fmt.Errorf("user '%s' does not have '%s' role for '%s'", u.ID, role, appID)
	}
	return apps.Get(appID)
}

func (c Claims) Session() (*Session, error) {
	sid, ok := c["sid"].(string)
	if !ok {
		return nil, fmt.Errorf("no sid in claims")
	}
	if sessions.Exists(sid) {
		return sessions.Get(sid), nil
	}
	return sessions.Create(sid, c)
}

func EncodeClaims(claims Claims) (string, error) {
	token := jwt.New(jwt.SigningMethodHS256)
	tc := token.Claims.(jwt.MapClaims)
	tc["exp"] = time.Now().Add(time.Hour * 72).Unix()
	for k, v := range claims {
		tc[k] = v
	}
	return token.SignedString([]byte(AUTH_SECRET))
}

func DecodeClaims(token string) (Claims, error) {
	t, err := jwt.Parse(token, func(token *jwt.Token) (interface{}, error) {
		return []byte(AUTH_SECRET), nil
	})
	if err != nil {
		return nil, err
	}
	if claims, ok := t.Claims.(jwt.MapClaims); ok {
		return Claims(claims), nil
	}
	return nil, fmt.Errorf("failed to decode token")
}
