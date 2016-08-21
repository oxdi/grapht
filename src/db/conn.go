package db

import (
	"graph"
	"sync"

	"github.com/graphql-go/graphql"
	"github.com/graphql-go/graphql/gqlerrors"
)

type Conn struct {
	g   *graph.Graph
	db  *DB
	uid string
	sync.RWMutex
}

func (c *Conn) Query(query string, params map[string]interface{}) *graphql.Result {
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
		VariableValues: params,
	})
}

func (c *Conn) Commit() error {
	return c.db.commit(c.g)
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
