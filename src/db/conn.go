package db

import (
	"fmt"
	"graph"
	"sync"
	"time"

	"github.com/graphql-go/graphql"
	"github.com/graphql-go/graphql/gqlerrors"
)

func resultErr(result *graphql.Result) error {
	for _, err := range result.Errors {
		return fmt.Errorf("%s", err)
	}
	return nil
}

type Conflict struct {
	Mutation *M
	Err      error
}

type Conn struct {
	g      *graph.Graph
	db     *DB
	claims Claims
	tokens []*Token
	log    []*M
	sync.RWMutex
	OnChange   func()
	OnConflict func(*Conflict)
}

func (c *Conn) GetNode(id string) *graph.Node {
	return c.g.Get(id)
}

func (c *Conn) GetTokens() ([]*Token, error) {
	return c.tokens, nil
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
	oldGraph := c.g
	result := c.query(query, params)
	err := resultErr(result)
	if err != nil { // if error return graph to last state
		c.g = oldGraph
	} else if oldGraph != c.g { // if changed, log the query as a mutation
		c.log = append(c.log, &M{
			Timestamp: time.Now(),
			Claims:    c.claims,
			Query:     query,
			Params:    params,
		}) // tell connection to update subscriptions
		if c.OnChange != nil {
			c.OnChange()
		}
	}
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
	fmt.Println("COMMITTTING")
	if len(c.log) == 0 {
		fmt.Println("NOTHING TO COMMIT")
		return nil
	}
	log := c.log
	c.log = nil
	if err := c.db.commit(log); err != nil {
		return err
	}
	return nil
}

// rebase is called when the parent db is updated
// it resets the base graph and reapplies any pending mutations
// conflicting mutations are dropped from the connection's pending log
//
func (c *Conn) rebase(g *graph.Graph) error {
	if err := c.update(g); err != nil {
		return err
	}
	log := []*M{}
	for _, m := range c.log {
		if err := c.apply(m); err != nil {
			fmt.Println("dropping conflicting mutation during rebase:", m, err)
			if c.OnConflict != nil {
				c.OnConflict(&Conflict{
					Mutation: m,
					Err:      err,
				})
			}
		} else {
			log = append(log, m)
		}
	}
	if len(log) != len(c.log) {
		c.log = log
	}
	return nil
}

func (c *Conn) update(g *graph.Graph) error {
	c.Lock()
	c.g = g
	c.Unlock()
	return nil
}

func (c *Conn) apply(m *M) error {
	result := c.query(m.Query, m.Params)
	if len(result.Errors) > 0 {
		for _, err := range result.Errors {
			return fmt.Errorf("failed to apply mutation %s: %s", m.Timestamp, err)
		}
	}
	return nil
}

func (c *Conn) Close() error {
	return c.db.closeConnection(c)
}

func (c *Conn) close() error {
	return c.db.closeConnectionWithoutLock(c)
}
