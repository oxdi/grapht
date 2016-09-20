package main

import (
	"encoding/json"
	"fmt"
	"io/ioutil"
	"net/http"
	"os"
	"path/filepath"

	"github.com/labstack/echo"
)

const (
	GuestRole = "guest"
	AdminRole = "admin"
)

type AppPermission struct {
	ID   string `json:"id"`
	Role string `json:"role"`
}

type User struct {
	ID       string           `json:"id,omitempty"`
	Password string           `json:"password,omitempty"`
	Email    string           `json:"email,omitempty"`
	Apps     []*AppPermission `json:"apps"`
	Guest    bool             `json:"guest,omitempty"`
}

func (u *User) HasAppRole(appID string, role string) bool {
	for _, perm := range u.Apps {
		if perm.ID == appID && perm.Role == role {
			return true
		}
	}
	return false
}

func (u *User) GrantAppRole(appID string, role string) error {
	if !isValidID(appID) {
		return fmt.Errorf("invalid id")
	}
	if role == "" {
		return fmt.Errorf("invalid role")
	}
	if u.HasAppRole(appID, role) {
		return nil
	}
	u.Apps = append(u.Apps, &AppPermission{
		ID:   appID,
		Role: role,
	})
	return users.Save()
}

type UserCollection struct {
	Users    []*User `json:"users"`
	filename string
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
	if u, _ := uc.Get(newUser.ID); u != nil {
		return nil, fmt.Errorf("user already exists")
	}
	if u, _ := uc.GetByEmail(newUser.Email); u != nil {
		return nil, fmt.Errorf("email already exists")
	}
	uc.Users = append(uc.Users, newUser)
	if err := uc.Save(); err != nil {
		return nil, err
	}
	return newUser, nil
}

func (uc *UserCollection) Get(id string) (*User, error) {
	for _, u := range uc.Users {
		if u.ID == id {
			return u, nil
		}
	}
	return nil, fmt.Errorf("user not found")
}

func (uc *UserCollection) GetByEmail(email string) (*User, error) {
	for _, u := range uc.Users {
		if u.Email == email {
			return u, nil
		}
	}
	return nil, fmt.Errorf("user not found")
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

func (uc *UserCollection) GetAllHandler(c echo.Context, userClaims Claims) error {
	currentUser, err := userClaims.User()
	if err != nil {
		return err
	}
	us := []*User{}
	for _, u := range users.Users {
		if u.ID != currentUser.ID {
			continue
		}
		us = append(us, u)

	}
	return c.JSON(http.StatusOK, us)
}

func (uc *UserCollection) GetHandler(c echo.Context, userClaims Claims) error {
	u, err := userClaims.User()
	if err != nil {
		return err
	}
	return c.JSON(http.StatusOK, u)
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

func (uc *UserCollection) Save() error {
	b, err := json.Marshal(uc.Users)
	if err != nil {
		return err
	}
	if err := ioutil.WriteFile(uc.filename, b, 0644); err != nil {
		return err
	}
	return nil
}

func LoadUsers(filename string) (*UserCollection, error) {
	uc := &UserCollection{
		filename: filename,
	}
	// warn if missing
	if _, err := os.Stat(uc.filename); os.IsNotExist(err) {
		fmt.Println("WARNING: no users file...creating")
		b := []byte("[]")
		if err := ioutil.WriteFile(uc.filename, b, 0644); err != nil {
			return nil, fmt.Errorf("failed to create %s: %s", uc.filename, err.Error())
		}
	}
	// read file
	b, err := ioutil.ReadFile(uc.filename)
	if err != nil {
		return nil, fmt.Errorf("failed to load %s: %s", uc.filename, err.Error())
	}
	if err := json.Unmarshal(b, &uc.Users); err != nil {
		return nil, fmt.Errorf("failed to load %s: corrupt", uc.filename)
	}
	// add the guest user
	uc.Users = append(uc.Users, &User{
		ID:       "guest",
		Password: "guest",
		Guest:    true,
	})
	return uc, nil
}

var users *UserCollection

func init() {
	uc, err := LoadUsers(filepath.Join(DATA_DIR, "users.json"))
	if err != nil {
		panic(err)
	}
	users = uc
}
