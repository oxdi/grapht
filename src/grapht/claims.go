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

func (c Claims) App() (*App, error) {
	u, err := c.User()
	if err != nil {
		return nil, err
	}
	id, ok := c["aid"].(string)
	if !ok {
		return nil, fmt.Errorf("no aid in claims")
	}
	// TODO: check if user is authorized to use app
	if u.ID != "chrisfarms" {
		fmt.Println("TODO: check if user is authorized to use app")
		// return nil, fmt.Errorf("only chrisfarms can do stuff")
	}
	return apps.Get(id)
}

func (c Claims) Session() (*Session, error) {
	id, ok := c["sid"].(string)
	if !ok {
		return nil, fmt.Errorf("no sid in claims")
	}
	return sessions.Get(id)
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
