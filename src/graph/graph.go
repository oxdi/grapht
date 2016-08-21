package graph

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
	for _, n := range g.nodes {
		if n.id == v.ID {
			continue
		}
		g2.nodes = append(g2.nodes, n)
	}
	n := &node{
		id:    v.ID,
		t:     v.Type,
		attrs: Attrs{},
	}
	for k, v := range v.Attrs {
		n.attrs[k] = v
	}
	g2.nodes = append(g.nodes, n)
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
	g2 = g2.Disconnect(EdgeConfig{From: id})
	g2 = g2.Disconnect(EdgeConfig{To: id})
	return g2
}

func (g *Graph) Disconnect(cfg EdgeConfig) *Graph {
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
	if cfg.HasOne {
		g2.edges = []*edge{}
		for _, e := range g.edges {
			if e.name == cfg.Name && e.from == cfg.From {
				continue
			}
			g2.edges = append(g2.edges, e)
		}
	} else {
		g2.edges = g.edges
		if i := g2.indexOfDupConnection(cfg); i != -1 {
			g2.edges = append(g2.edges[:i], g2.edges[i+1:]...)

		}
	}
	// check for dup
	g2.edges = append(g2.edges, &edge{
		from:     cfg.From,
		to:       cfg.To,
		name:     cfg.Name,
		hasOne:   cfg.HasOne,
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
	g2 := g.clone()
	g2.types = append(g2.types, &t)
	return g2
}

func (g *Graph) Type(name string) *Type {
	for _, t := range g.types {
		if t.Name == name {
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

func New() *Graph {
	g := &Graph{}
	return g
}

//-----------
