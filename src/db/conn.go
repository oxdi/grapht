package db

import (
	"graph"
	"sync"
	"time"

	"github.com/graphql-go/graphql"
	"github.com/graphql-go/graphql/gqlerrors"
)

type Conn struct {
	g   *graph.Graph
	db  *DB
	uid string
	log []*M
	sync.RWMutex
	OnChange func()
}

func (c *Conn) Query(query string) *graphql.Result {
	return c.QueryWithParams(query, nil)
}

func (c *Conn) QueryWithParams(query string, params map[string]interface{}) *graphql.Result {
	return c.query(query, params)
}

func (c *Conn) Exec(query string) *graphql.Result {
	return c.ExecWithParams(query, nil)
}

func (c *Conn) ExecWithParams(query string, params map[string]interface{}) *graphql.Result {
	c.log = append(c.log, &M{
		T: time.Now(),
		Q: query,
		U: c.uid,
		P: params,
	})
	result := c.query(query, params)
	return result
}

func (c *Conn) query(query string, params map[string]interface{}) *graphql.Result {
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
	if err := c.db.commit(c.g, c.log); err != nil {
		return err
	}
	return nil
}

// update is called when the parent db is updated
// it resets the base graph and reapplies any pending mutations
// if it fails then the pending mutations are no longer valid (for instance
// maybe someone else changed the type system making the pending mutations fail)
//
func (c *Conn) update(g *graph.Graph) error {
	c.Lock()
	defer c.Unlock()
	c.g = g
	c.log = []*M{}
	// for _, m := range c.log {
	// 	err := c.ExecWithParams(m.Q, m.P)
	// 	if err != nil {
	// 		fmt.Println("cannot apply pending mutations after update:", m, err)
	// 	}
	// }
	if c.OnChange != nil {
		c.OnChange()
	}
	return nil
}

func (c *Conn) Close() error {
	return c.db.closeConnection(c)
}
