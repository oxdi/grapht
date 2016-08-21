package db

import (
	"fmt"
	"graph"
	"sync"

	"github.com/graphql-go/graphql"
	"github.com/graphql-go/graphql/gqlerrors"
)

type Conn struct {
	g   *graph.Graph
	db  *DB
	uid string
	log []string
	sync.RWMutex
}

func (c *Conn) Query(query string) *graphql.Result {
	query = fmt.Sprintf(`query { %s }`, query)
	return c.query(query)
}

func (c *Conn) Exec(query string) *graphql.Result {
	c.log = append(c.log, query)
	query = fmt.Sprintf(`mutation { %s }`, query)
	return c.query(query)
}

func (c *Conn) query(query string) *graphql.Result {
	// generate schema for db
	s, err := NewGraphqlContext(c).Schema()
	if err != nil {
		return &graphql.Result{
			Errors: gqlerrors.FormatErrors(err),
		}
	}
	// exec
	return graphql.Do(graphql.Params{
		Schema:         *s,
		RequestString:  query,
		VariableValues: map[string]interface{}{},
	})
}

func (c *Conn) Commit() error {
	if err := c.db.commit(c.g, c.log, c.uid); err != nil {
		return err
	}
	c.log = []string{}
	return nil
}

func (c *Conn) update(g *graph.Graph) error {
	c.Lock()
	defer c.Unlock()
	c.g = g
	return nil
}

func (c *Conn) Close() error {
	return c.db.closeConnection(c)
}
