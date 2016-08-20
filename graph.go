package graph

import "encoding/json"
import "fmt"

type Value interface {
	String() string
}

type StringValue struct {
	b []byte
}

func (v *StringValue) String() string {
	var s string
	json.Unmarshal(v.b, &s)
	return s
}

func String(s string) *StringValue {
	b,_ := json.Marshal(s)
	return &StringValue{b:b}
}

type node struct {
	id string
	value Value
	attrs map[string]string
}

type Node struct {
	g *Graph
	n *node
}

func (n *Node) ID() string {
	return n.n.id
}

func (n *Node) Value() Value {
	return n.n.value
}

func (n *Node) Attr(key string) string {
	if n.n.attrs == nil {
		return ""
	}
	return n.n.attrs[key]
}

func (n *Node) Edges() []*Edge {
	edges := []*Edge{}
	for _,e := range n.g.edges {
		if e.from != n.n.id {
			continue
		}
		edges = append(edges, &Edge{
			e:e,
			g:n.g,
		})
	}
	return edges
}

type EdgeKind string
var(
	UnsetEdgeKind EdgeKind = ""
	HasOne EdgeKind = "HasOne"
	HasMany EdgeKind = "HasMany"
)


type edge struct {
	name string
	from string
	to string
	attrs map[string]string
	kind EdgeKind
	onDelete func(e *Edge) *Graph
}

type Edge struct {
	g *Graph
	e *edge
}

func (e *Edge) Node() *Node {
	return e.g.Get(e.e.to)
}

type EdgeConfig struct {
	Name string
	From string
	To string
	Kind EdgeKind
	OnDelete func(e *Edge) *Graph
}

func Cascade(e *Edge) *Graph {
	return e.g.Remove(e.e.to)
}

func (cfg *EdgeConfig) Validate() error {
	if cfg.Name == "" {
		return fmt.Errorf("invalid edge config: Name field is required")
	}
	if cfg.From == "" {
		return fmt.Errorf("invalid edge config: From field is required")
	}
	if cfg.To == "" {
		return fmt.Errorf("invalid edge config: To field is required")
	}
	if cfg.Kind == UnsetEdgeKind {
		return fmt.Errorf("invalid edge config: Kind field is required")
	}
	return nil
}

//-----------

type Graph struct {
	nodes []*node
	edges []*edge
}

func (g *Graph) AddNode(id string) (*Graph) {
	g2 := &Graph{}
	g2.nodes = append(g.nodes, &node{id:id})
	g2.edges = g.edges
	return g2
}

func (g *Graph) Remove(id string) (*Graph) {
	g2 := &Graph{}
	for _,n := range g.nodes {
		if n.id == id {
			continue
		}
		g2.nodes = append(g2.nodes, n)
	}
	g2.edges = g.edges
	g2 = g2.Disconnect(EdgeConfig{From: id})
	g2 = g2.Disconnect(EdgeConfig{To: id})
	return g2
}

func (g *Graph) Disconnect(cfg EdgeConfig) (*Graph) {
	g2 := &Graph{}
	g2.nodes = g.nodes
	removed := []*edge{}
	for _,e := range g.edges {
		if (cfg.Name == "" || cfg.Name == e.name) &&
		(cfg.From == "" || cfg.From == e.from) &&
		(cfg.To == "" || cfg.To == e.to) {
			removed = append(removed, e)
			continue
		}
		g2.edges = append(g2.edges, e)
	}
	for _,e := range removed {
		if e.onDelete != nil {
			g2 = e.onDelete(&Edge{e:e,g:g2})
		}
	}
	return g2
}

// AddEdge creates a link between two nodes
func (g *Graph) Connect(cfg EdgeConfig) (*Graph) {
	g2 := &Graph{}
	g2.nodes = g.nodes
	if err := cfg.Validate(); err != nil {
		panic(err)
	}
	if cfg.Kind == HasOne {
		for _,e := range g.edges {
			if e.name == cfg.Name && e.from == cfg.From {
				continue
			}
			g2.edges = append(g2.edges, e)
		}
	} else {
		g2.edges = g.edges
	}
	g2.edges = append(g2.edges, &edge{
		from: cfg.From,
		to: cfg.To,
		name: cfg.Name,
		kind: cfg.Kind,
		onDelete: cfg.OnDelete,
	})
	return g2
}


// Get a node from the graph by id
func (g *Graph) Get(id string) *Node {
	for _,n := range g.nodes {
		if n.id == id {
			return &Node{n:n,g:g}
		}
	}
	return nil
}

func (g *Graph) SetNodeAttr(id string, key string, value string) *Graph {
	g2 := &Graph{}
	g2.edges = g.edges
	g2.nodes = make([]*node, len(g.nodes))
	for i,n := range g.nodes {
		if n.id == id {
			m := map[string]string{}
			for k,v := range n.attrs {
				m[k] = v
			}
			m[key] = value
			n = &node{
				id:n.id,
				value:n.value,
				attrs:m,
			}
		}
		g2.nodes[i] = n
	}
	return g2
}

func New() *Graph {
	g := &Graph{}
	return g
}

//-----------
