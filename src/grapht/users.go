package main

import (
	"fmt"
	"net/http"

	"github.com/labstack/echo"
)

type User struct {
	ID        string   `json:"id,omitempty"`
	Password  string   `json:"password,omitempty"`
	Email     string   `json:"email,omitempty"`
	Databases []string `json:"-"`
	Guest     bool     `json:"guest,omitempty"`
}

type UserCollection struct {
	users []*User
}

func (uc *UserCollection) Create(newUser *User) (*User, error) {
	if newUser == nil {
		return nil, fmt.Errorf("newUser cannot be nil")
	}
	if newUser.ID == "" {
		return nil, fmt.Errorf("ID is required")
	}
	if newUser.Password == "" {
		return nil, fmt.Errorf("password is required")
	}
	if newUser.Email == "" {
		return nil, fmt.Errorf("email is required")
	}
	u, _ := uc.Get(newUser.ID)
	if u != nil {
		return nil, fmt.Errorf("id already exists")
	}
	uc.users = append(uc.users, newUser)
	return newUser, nil
}

func (uc *UserCollection) Get(id string) (*User, error) {
	for _, u := range uc.users {
		if u.ID == id {
			return u, nil
		}
	}
	return nil, fmt.Errorf("cannot get user for that id")
}

func (uc *UserCollection) Authenticate(id string, pw string) (*User, error) {
	u, err := uc.Get(id)
	if err != nil {
		return nil, err
	}
	if u == nil {
		return nil, fmt.Errorf("nil user returned")
	}
	if u.Password != pw {
		return nil, fmt.Errorf("invalid password")
	}
	return u, nil
}

func (uc *UserCollection) CreateHandler(c echo.Context) error {
	params := struct {
		ID       string `json:"id"`
		Password string `json:"password"`
		Email    string `json:"email"`
	}{}
	if err := c.Bind(&params); err != nil {
		return err
	}
	// Validate params
	if params.ID == "" {
		return fmt.Errorf("user.id is required")
	}
	if params.Password == "" {
		return fmt.Errorf("user.password is required")
	}
	if params.Email == "" {
		return fmt.Errorf("user.email is required")
	}
	// Create user
	u, err := uc.Create(&User{
		ID:       params.ID,
		Password: params.Password,
		Email:    params.Email,
	})
	if err != nil {
		return err
	}
	return c.JSON(http.StatusCreated, u)
}

func (uc *UserCollection) AuthenticateHandler(c echo.Context) error {
	params := &struct {
		ID       string `json:"id"`
		Password string `json:"password"`
	}{}
	if err := c.Bind(params); err != nil {
		return err
	}
	// Validate params
	if params.ID == "" {
		return fmt.Errorf("auth.id is required")
	}
	if params.Password == "" {
		return fmt.Errorf("auth.password is required")
	}
	// lookup user
	u, err := users.Authenticate(params.ID, params.Password)
	if err != nil {
		return err
	}
	if u == nil {
		return fmt.Errorf("invalid userid and/or password")
	}
	// Create token
	t, err := EncodeClaims(map[string]interface{}{
		"uid": u.ID,
	})
	if err != nil {
		return err
	}
	res := struct {
		UserToken string `json:"userToken"`
	}{
		UserToken: t,
	}
	return c.JSON(http.StatusOK, res)
}

var users = &UserCollection{
	users: []*User{
		&User{
			ID:       "guest",
			Password: "guest",
			Guest:    true,
		},
		&User{
			ID:        "chrisfarms",
			Password:  "ncd78781",
			Databases: []string{"example", "farmsdb"},
		},
	},
}
