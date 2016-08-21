package graph

import "testing"
import "testutil"

func TestAddNode(t *testing.T) {
	g := New()
	g = g.Set(NodeConfig{
		ID: "alice",
	})
	expect := testutil.Expect(t)
	expect(g.Get("alice")).ToNotBeNil()
}

func TestAddNodeDoesntModifyOld(t *testing.T) {
	g := New()
	_ = g.Set(NodeConfig{
		ID: "alice",
	})
	expect := testutil.Expect(t)
	expect(g.Get("alice")).ToBeNil()
}

func TestSetNodeAttr(t *testing.T) {
	g := New()
	g = g.Set(NodeConfig{
		ID: "1",
		Attrs: Attrs{
			"name": "alice",
		},
	})
	expect := testutil.Expect(t)
	expect(g.Get("1").Attr("name")).ToEqual("alice")
}

func TestSetNodeAttrDoesNotModifyOld(t *testing.T) {
	g := New()
	g = g.Set(NodeConfig{
		ID: "1",
		Attrs: Attrs{
			"name": "alice",
		},
	})
	_ = g.Set(NodeConfig{
		ID: "1",
		Attrs: Attrs{
			"name": "bob",
		},
	})
	expect := testutil.Expect(t)
	expect(g.Get("1").Attr("name")).ToEqual("alice")
}

func TestHasManyConnection(t *testing.T) {
	g := New()
	g = g.Set(NodeConfig{
		ID: "alice",
	})
	g = g.Set(NodeConfig{
		ID: "bob",
	})
	g = g.Set(NodeConfig{
		ID: "jeff",
	})
	g = g.Connect(EdgeConfig{
		From: "alice",
		To:   "bob",
		Name: "friend",
	})
	g = g.Connect(EdgeConfig{
		From: "alice",
		To:   "jeff",
		Name: "friend",
	})
	expect := testutil.Expect(t)
	expect(len(g.Get("alice").Out())).ToEqual(2)
	expect(g.Get("alice").Out()[0].Node().ID()).ToEqual("bob")
	expect(g.Get("alice").Out()[1].Node().ID()).ToEqual("jeff")
	expect(g.Get("bob").In()[0].Node().ID()).ToEqual("alice")
}

func TestDuplicateHasManyConnection(t *testing.T) {
	g := New()
	g = g.Set(NodeConfig{
		ID: "1",
	})
	g = g.Set(NodeConfig{
		ID: "2",
	})
	cfg := EdgeConfig{
		From: "1",
		To:   "2",
		Name: "link",
	}
	g = g.Connect(cfg)
	g = g.Connect(cfg)
	expect := testutil.Expect(t)
	expect(len(g.Get("1").Out())).ToEqual(1)
}

func TestDuplicateHasOneConnectionIsIgnored(t *testing.T) {
	g := New()
	g = g.Set(NodeConfig{
		ID: "1",
	})
	g = g.Set(NodeConfig{
		ID: "2",
	})
	cfg := EdgeConfig{
		From:   "1",
		To:     "2",
		HasOne: true,
		Name:   "link",
	}
	g = g.Connect(cfg)
	g = g.Connect(cfg)
	expect := testutil.Expect(t)
	expect(len(g.Get("1").Out())).ToEqual(1)
}

func TestHasManyConnectionDoesNotModifyOld(t *testing.T) {
	g := New()
	g = g.Set(NodeConfig{
		ID: "alice",
	})
	g = g.Set(NodeConfig{
		ID: "bob",
	})
	g = g.Set(NodeConfig{
		ID: "jeff",
	})
	g = g.Connect(EdgeConfig{
		From: "alice",
		To:   "bob",
		Name: "friend",
	})
	_ = g.Connect(EdgeConfig{
		From: "alice",
		To:   "jeff",
		Name: "friend",
	})
	expect := testutil.Expect(t)
	expect(len(g.Get("alice").Out())).ToEqual(1)
	expect(g.Get("alice").Out()[0].Node().ID()).ToEqual("bob")
}

func TestHasOneConnection(t *testing.T) {
	expect := testutil.Expect(t)
	g := New()
	g = g.Set(NodeConfig{
		ID: "alice",
	})
	g = g.Set(NodeConfig{
		ID: "bob",
	})
	g = g.Connect(EdgeConfig{
		From:   "alice",
		To:     "bob",
		HasOne: true,
		Name:   "friend",
	})
	expect(len(g.Get("alice").Out())).ToEqual(1)
	expect(g.Get("alice").Out()[0].Node().ID()).ToEqual("bob")
	// ...now connect alice -> jeff
	g = g.Set(NodeConfig{
		ID: "jeff",
	})
	g = g.Connect(EdgeConfig{
		From:   "alice",
		To:     "jeff",
		HasOne: true,
		Name:   "friend",
	})
	expect(len(g.Get("alice").Out())).ToEqual(1)
	expect(g.Get("alice").Out()[0].Node().ID()).ToEqual("jeff")
}

func TestDisconnectOnSourceRemoved(t *testing.T) {
	g := New()
	g = g.Set(NodeConfig{
		ID: "1",
	})
	g = g.Set(NodeConfig{
		ID: "2",
	})
	g = g.Connect(EdgeConfig{
		From: "1",
		To:   "2",
		Name: "link",
	})
	expect := testutil.Expect(t)
	expect(len(g.edges)).ToEqual(1)
	g = g.Remove("1")
	expect(len(g.edges)).ToEqual(0)
}

func TestDisconnectOnTargetRemoved(t *testing.T) {
	g := New()
	g = g.Set(NodeConfig{
		ID: "1",
	})
	g = g.Set(NodeConfig{
		ID: "2",
	})
	g = g.Connect(EdgeConfig{
		From: "1",
		To:   "2",
		Name: "link",
	})
	expect := testutil.Expect(t)
	expect(len(g.edges)).ToEqual(1)
	g = g.Remove("2")
	expect(len(g.edges)).ToEqual(0)
}

func TestDisconnectSource(t *testing.T) {
	g := New()
	g = g.Set(NodeConfig{
		ID: "1",
	})
	g = g.Set(NodeConfig{
		ID: "2",
	})
	g = g.Set(NodeConfig{
		ID: "3",
	})
	g = g.Connect(EdgeConfig{
		From:   "1",
		To:     "2",
		HasOne: true,
		Name:   "linkA",
	})
	g = g.Connect(EdgeConfig{
		From:   "1",
		To:     "3",
		HasOne: true,
		Name:   "linkB",
	})
	g = g.Connect(EdgeConfig{
		From:   "2",
		To:     "3",
		HasOne: true,
		Name:   "linkC",
	})
	g = g.Disconnect(EdgeConfig{
		From: "1",
	})
	expect := testutil.Expect(t)
	expect(len(g.Get("1").Out())).ToEqual(0)
	expect(len(g.Get("2").Out())).ToEqual(1)
	expect(g.Get("2").Out()[0].Node().ID()).ToEqual("3")
}

func TestDisconnectByNameAndSource(t *testing.T) {
	g := New()
	g = g.Set(NodeConfig{
		ID: "1",
	})
	g = g.Set(NodeConfig{
		ID: "2",
	})
	g = g.Connect(EdgeConfig{
		From: "1",
		To:   "2",
		Name: "linkA",
	})
	g = g.Connect(EdgeConfig{
		From: "1",
		To:   "2",
		Name: "linkB",
	})
	g = g.Disconnect(EdgeConfig{
		From: "1",
		Name: "NON-EXISTANT-NAME",
	})
	expect := testutil.Expect(t)
	expect(len(g.Get("1").Out())).ToEqual(2)
	g = g.Disconnect(EdgeConfig{
		From: "1",
		Name: "linkA",
	})
	expect(len(g.Get("1").Out())).ToEqual(1)
}

func TestHasOneConnectionDoesNotModifyOld(t *testing.T) {
	expect := testutil.Expect(t)
	g := New()
	g = g.Set(NodeConfig{
		ID: "alice",
	})
	g = g.Set(NodeConfig{
		ID: "bob",
	})
	g = g.Connect(EdgeConfig{
		From:   "alice",
		To:     "bob",
		HasOne: true,
		Name:   "friend",
	})
	// ...now connect alice -> jeff
	g = g.Set(NodeConfig{
		ID: "jeff",
	})
	_ = g.Connect(EdgeConfig{
		From:   "alice",
		To:     "jeff",
		HasOne: true,
		Name:   "friend",
	})
	expect(len(g.Get("alice").Out())).ToEqual(1)
	expect(g.Get("alice").Out()[0].Node().ID()).ToEqual("bob")
}

func TestCascadingDelete(t *testing.T) {
	g := New()
	g = g.Set(NodeConfig{
		ID: "jeff",
	})
	g = g.Set(NodeConfig{
		ID: "category",
	})
	g = g.Connect(EdgeConfig{
		From:   "category",
		To:     "jeff",
		HasOne: true,
		Name:   "author",
	})
	g = g.Set(NodeConfig{
		ID: "product1",
	})
	g = g.Connect(EdgeConfig{
		From:     "category",
		To:       "product1",
		Name:     "product",
		OnDelete: Cascade,
	})
	g = g.Set(NodeConfig{
		ID: "product2",
	})
	g = g.Connect(EdgeConfig{
		From:     "category",
		To:       "product2",
		Name:     "product",
		OnDelete: Cascade,
	})
	g = g.Remove("category")
	expect := testutil.Expect(t)
	expect(g.Get("category")).ToBeNil()
	expect(g.Get("product1")).ToBeNil()
	expect(g.Get("product2")).ToBeNil()
	expect(g.Get("jeff")).ToNotBeNil()
}

func TestDefineType(t *testing.T) {
	g := New()
	expect := testutil.Expect(t)
	expect(len(g.Types())).ToEqual(0)
	g = g.DefineType(Type{
		Name: "User",
		Fields: Fields{
			&Field{
				Name: "name",
				Type: "text",
			},
		},
	})
	expect(len(g.Types())).ToEqual(1)
	expect(g.Type("User").Field("name").Type).ToEqual("text")
	g = g.Set(NodeConfig{
		ID:   "alice",
		Type: "User",
	})
	expect(g.Get("alice").Type().Name).ToEqual("User")
}
