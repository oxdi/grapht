package db

import (
	"bytes"
	"encoding/json"
	"fmt"
	"os"
	"testing"

	"github.com/graphql-go/graphql"
)

func dump(r *graphql.Result) {
	if len(r.Errors) > 0 {
		fmt.Println("FAIL", r.Errors)
		os.Exit(1)
	}
	b, _ := json.MarshalIndent(r.Data, "", "  ")
	fmt.Println(string(b))
}

func TestConnection(t *testing.T) {
	var buf bytes.Buffer
	db, err := New(&buf)
	if err != nil {
		t.Fatal(err)
	}
	c := db.NewConnection("")
	defer c.Close()
	dump(c.Exec(`
		defineType(name: "User", fields:[
			{name:"username",type:"Text"},
			{name:"friends",type:"HasMany",edge:"friend"}
		]) {
			name
		}
	`))
	dump(c.Exec(`
		alice:set(id:"alice",type:"User",attrs:[{name:"username",value:"alice1"}]) {
			id
			type {
				name
				fields {
					name
					type
					edge
				}
			}
			attrs {
				name
				value
			}
		}
	`))
	dump(c.Exec(`
		bob:set(id:"bob",type:"User",attrs:[{name:"username",value:"bob1"}]) {
			id
		}
	`))
	dump(c.Exec(`
		jeff:set(id:"jeff",type:"User",attrs:[{name:"username",value:"jeff1"}]) {
			id
		}
	`))
	dump(c.Exec(`
		connect(from:"alice",to:"bob",name:"friend"){
			from {
				id
			}
			to {
				id
			}
		}
	`))
	dump(c.Exec(`
		connect(from:"alice",to:"jeff",name:"friend"){
			from {
				id
			}
			to {
				id
			}
		}
	`))
	dump(c.Exec(`
		connect(from:"alice",to:"jeff",name:"like"){
			name
			from {
				id
			}
			to {
				id
			}
		}
	`))
	dump(c.Query(`
		aliceWithFriends:node(id:"alice") {
			...on User {
				username
				friendsViaOut:out(name:"friend") {
					id
					friendsViaIn:in(name:"friend") {
						id
					}
				}
			}
		}
	`))
	dump(c.Exec(`
		disconnect(from:"alice",to:"bob",name:"friend"){
			from {
				id
			}
			to {
				id
			}
		}
	`))
	dump(c.Query(`
		aliceFewerFriends:node(id:"alice") {
			id
			edges(name:"friend",dir:"out") {
				name
				node {
					id
					edges(name:"friend",dir:"in") {
						node {
							id
						}
					}
				}
			}
		}
	`))
	dump(c.Exec(`
		remove(id:"jeff") {
			id
		}
	`))
	dump(c.Query(`
		aliceNoFriends:node(id:"alice") {
			...on User {
				friends {
					id
				}
			}
		}
	`))
	dump(c.Query(`
		users:nodes(type:[User]) {
			...on User {
				username
			}
		}
	`))
	c2 := db.NewConnection("")
	defer c2.Close()
	dump(c2.Query(`
		c2NodeShouldBeNull:node(id:"alice") {
			id
		}
	`))
	if err := c.Commit(); err != nil {
		t.Fatal(err)
	}
	c2 = db.NewConnection("")
	defer c2.Close()
	dump(c2.Query(`
		c2NodeShouldNowBeOK:node(id:"alice") {
			id
		}
	`))
	db2, err := New(&buf)
	if err != nil {
		t.Fatal(err)
	}
	c2 = db2.NewConnection("")
	dump(c2.Query(`
		replayedUser:node(id:"alice") {
			...on User {
				id
				friends {
					id
				}
			}
		}
	`))
}

func TestOpen(t *testing.T) {
	fmt.Println("-----------------")
	testFile := "test.db"
	db, err := Open(testFile)
	if err != nil {
		t.Fatal(err)
	}
	c := db.NewConnection("")
	dump(c.Exec(`
		defineType(name: "User", fields:[
			{name:"username",type:"Text"}
		]) {
			name
		}
	`))
	dump(c.Exec(`
		alice:set(id:"alice",type:"User",attrs:[{name:"username",value:"alice1"}]) {
			id
		}
	`))
	if err := c.Commit(); err != nil {
		t.Fatal(err)
	}
	db.Close()
	db, err = Open(testFile)
	if err != nil {
		t.Fatal(err)
	}
	c = db.NewConnection("")
	dump(c.Query(`
		users:nodes(type:[User]) {
			...on User {
				username
			}
		}
	`))
	dump(c.Exec(`
		bob:set(id:"bob",type:"User",attrs:[{name:"username",value:"bob1"}]) {
			id
		}
	`))
	if err := c.Commit(); err != nil {
		t.Fatal(err)
	}
	db.Close()
	db, err = Open(testFile)
	if err != nil {
		t.Fatal(err)
	}
	c = db.NewConnection("")
	dump(c.Query(`
		users:nodes(type:[User]) {
			...on User {
				username
			}
		}
	`))
	os.Remove(testFile)
}
