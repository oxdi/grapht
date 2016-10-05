package graph

import "fmt"

var DefaultValidator = func(n *Node) {

}

type Graph struct {
	nodes []*node
	edges []*edge
	types []*Type
}

func (g *Graph) Validiate() error {
	return nil
}

func (g *Graph) clone() *Graph {
	return &Graph{
		nodes: g.nodes,
		edges: g.edges,
		types: g.types,
	}
}

func (g *Graph) Set(v NodeConfig) *Graph {
	g2 := g.clone()
	g2.nodes = []*node{}
	var old *node
	for _, n := range g.nodes {
		if n.id == v.ID {
			old = n
			continue
		}
		g2.nodes = append(g2.nodes, n)
	}
	n := &node{
		id:     v.ID,
		typeID: v.TypeID,
		attrs:  v.Attrs,
	}
	if v.Merge && old != nil {
		inNew := func(name string) bool {
			for _, newAttr := range n.attrs {
				if newAttr.Name == name {
					return true
				}
			}
			return false
		}
		for _, oldAttr := range old.attrs {
			if inNew(oldAttr.Name) {
				continue
			}
			n.attrs = append(n.attrs, oldAttr)
		}
	}
	g2.nodes = append(g2.nodes, n)
	return g2
}

func (g *Graph) Remove(id string) *Graph {
	g2 := g.clone()
	g2.nodes = []*node{}
	for _, n := range g.nodes {
		if n.id == id {
			continue
		}
		g2.nodes = append(g2.nodes, n)
	}
	g2 = g2.Disconnect(EdgeMatch{From: id})
	g2 = g2.Disconnect(EdgeMatch{To: id})
	return g2
}

func (g *Graph) Disconnect(cfg EdgeMatch) *Graph {
	g2 := g.clone()
	g2.edges = []*edge{}
	removed := []*edge{}
	for _, e := range g.edges {
		if (cfg.Name == "" || cfg.Name == e.name) &&
			(cfg.From == "" || cfg.From == e.from) &&
			(cfg.To == "" || cfg.To == e.to) {
			removed = append(removed, e)
			continue
		}
		g2.edges = append(g2.edges, e)
	}
	for _, e := range removed {
		if e.onDelete != nil {
			g2 = e.onDelete(&Edge{e: e, g: g2})
		}
	}
	return g2
}

// AddEdge creates a link between two nodes
func (g *Graph) Connect(cfg EdgeConfig) *Graph {
	g2 := g.clone()
	if err := cfg.Validate(); err != nil {
		panic(err)
	}
	g2.edges = g.edges
	if i := g2.indexOfDupConnection(cfg); i != -1 {
		g2.edges = append(g2.edges[:i], g2.edges[i+1:]...)

	}
	if cfg.Name == "" {
		panic(fmt.Sprintf("name cannot be blank"))
	}
	if g.Get(cfg.From) == nil {
		panic(fmt.Sprintf("from node '%s' does not exist", cfg.From))
	}
	if g.Get(cfg.To) == nil {
		panic(fmt.Sprintf("from node '%s' does not exist", cfg.To))
	}
	// check for dup
	g2.edges = append(g2.edges, &edge{
		from:     cfg.From,
		to:       cfg.To,
		name:     cfg.Name,
		onDelete: cfg.OnDelete,
	})
	return g2
}

func (g *Graph) indexOfDupConnection(cfg EdgeConfig) int {
	for i, e := range g.edges {
		if e.from == cfg.From &&
			e.to == cfg.To &&
			e.name == cfg.Name {
			return i
		}
	}
	return -1
}

// Get a node from the graph by id
func (g *Graph) Get(id string) *Node {
	for _, n := range g.nodes {
		if n.id == id {
			return &Node{n: n, g: g}
		}
	}
	return nil
}

func (g *Graph) DefineType(t Type) *Graph {
	if t.ID == "" {
		panic("type id is required")
	}
	for _, f := range t.Fields {
		if f.Name == "" {
			panic("cannot create field with blank name")
		}
	}
	g2 := g.clone()
	g2.types = []*Type{}
	for _, tt := range g.types {
		if tt.ID == t.ID {
			continue
		}
		g2.types = append(g2.types, tt)
	}
	g2.types = append(g2.types, &t)
	return g2
}

func (g *Graph) TypeByName(name string) *Type {
	for _, t := range g.types {
		if t.Name == name {
			return t
		}
	}
	return nil
}

func (g *Graph) TypeByID(id string) *Type {
	for _, t := range g.types {
		if t.ID == id {
			return t
		}
	}
	return nil
}

func (g *Graph) Types() []*Type {
	return g.types
}

func (g *Graph) Nodes() Nodes {
	ns := Nodes{}
	for _, n := range g.nodes {
		ns = append(ns, &Node{
			n: n,
			g: g,
		})
	}
	return ns
}

func (g *Graph) Edges(m EdgeMatch) Edges {
	es := Edges{}
	for _, e := range g.edges {
		if (m.Name != "" && m.Name != e.name) ||
			(m.From != "" && m.From != e.from) ||
			(m.To != "" && m.To != e.to) {
			continue
		}
		es = append(es, &Edge{
			e: e,
			g: g,
		})
	}
	return es
}

func New() *Graph {
	g := &Graph{}
	return g
}

//-----------
