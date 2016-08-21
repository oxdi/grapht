package db

import (
	"encoding/json"
	"fmt"
	"testing"

	"github.com/graphql-go/graphql"
)

func dump(r *graphql.Result) {
	if len(r.Errors) > 0 {
		fmt.Println(r.Errors)
	}
	b, _ := json.MarshalIndent(r, "", "  ")
	fmt.Println(string(b))
}

func TestConnection(t *testing.T) {
	db := New()
	c := db.NewConnection()
	defer c.Close()
	r := c.Query(`
		mutation {
			defineType(name: "User", fields:[{name:"username",type:"text"}]) {
				name
			}
			set(id:"alice",type:"User",attrs:[{name:"username",value:"alice1"}]) {
				id
				type {
					name
				}
				attrs {
					name
					value
				}
			}
		}
	`, nil)
	dump(r)
}
