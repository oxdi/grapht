package db

import (
	"fmt"
	"graph"

	"github.com/chrisfarms/inflect"
	"github.com/graphql-go/graphql"
)

func castError(src interface{}, dst string) error {
	return fmt.Errorf("failed to cast %v to %s", src, dst)
}
func invalidArg(name string) error {
	return fmt.Errorf("invalid argument %s", name)
}

func NewGraphqlContext(c *Conn) *GraphqlContext {
	cxt := &GraphqlContext{
		conn:      c,
		types:     map[string]*graphql.Object{},
		fields:    graphql.Fields{},
		mutations: graphql.Fields{},
	}
	return cxt
}

type GraphqlContext struct {
	conn                  *Conn
	types                 map[string]*graphql.Object
	fields                graphql.Fields
	mutations             graphql.Fields
	fieldDefinitionObject *graphql.Object
	typeDefinitionObject  *graphql.Object
	attrObject            *graphql.Object
	nodeInterface         *graphql.Interface
	typeEnum              *graphql.Enum
	fieldNameEnum         *graphql.Enum
}

func (cxt *GraphqlContext) TypeObject() *graphql.Object {
	if cxt.typeDefinitionObject != nil {
		return cxt.typeDefinitionObject
	}
	cxt.typeDefinitionObject = graphql.NewObject(graphql.ObjectConfig{
		Name: "Type",
		Fields: graphql.Fields{
			"name": &graphql.Field{
				Type:        graphql.String,
				Description: "name of type",
			},
			"fields": &graphql.Field{
				Type:        graphql.NewList(cxt.FieldDefinitionObject()),
				Description: "field descriptions for this type",
				Resolve: func(p graphql.ResolveParams) (interface{}, error) {
					if t, ok := p.Source.(*graph.Type); ok {
						return t.Fields, nil
					}
					return []interface{}{}, nil
				},
			},
		},
	})
	return cxt.typeDefinitionObject
}

func (cxt *GraphqlContext) ValueTypeEnum() *graphql.Enum {
	return graphql.NewEnum(graphql.EnumConfig{
		Name:        "ValueTypeEnum",
		Description: "type of value held by the field, this determins the type of form field and how data is stored",
		Values: graphql.EnumValueConfigMap{
			string(Text): &graphql.EnumValueConfig{
				Description: "Generic text field",
			},
			string(Int): &graphql.EnumValueConfig{
				Description: "Generic int field",
			},
			string(Float): &graphql.EnumValueConfig{
				Description: "Generic float field",
			},
			string(Boolean): &graphql.EnumValueConfig{
				Description: "Generic bool field",
			},
			string(BcryptText): &graphql.EnumValueConfig{
				Description: "Text value that gets hashed before write",
			},
			string(HasOne): &graphql.EnumValueConfig{
				Description: "Traditional has-one style relationship to another node",
			},
			string(HasMany): &graphql.EnumValueConfig{
				Description: "Traditional has-many style relationship to other nodes",
			},
		},
	})

}

func (cxt *GraphqlContext) AttrObject() *graphql.Object {
	if cxt.attrObject != nil {
		return cxt.attrObject
	}
	cxt.attrObject = graphql.NewObject(graphql.ObjectConfig{
		Name: "Attr",
		Fields: graphql.Fields{
			"name": &graphql.Field{
				Type:        graphql.NewNonNull(graphql.String),
				Description: "attr name",
				Resolve: func(p graphql.ResolveParams) (interface{}, error) {
					attr, ok := p.Source.(*graph.Attr)
					if !ok {
						return nil, castError(p.Source, "Attr")
					}
					return attr.Name, nil
				},
			},
			"value": &graphql.Field{
				Type:        graphql.String,
				Description: "json encoded attr value",
				Resolve: func(p graphql.ResolveParams) (interface{}, error) {
					attr, ok := p.Source.(*graph.Attr)
					if !ok {
						return nil, castError(p.Source, "Attr")
					}
					return attr.Value, nil
				},
			},
		},
	})
	return cxt.attrObject
}
func (cxt *GraphqlContext) FieldDefinitionObject() *graphql.Object {
	if cxt.fieldDefinitionObject != nil {
		return cxt.fieldDefinitionObject
	}
	cxt.fieldDefinitionObject = graphql.NewObject(graphql.ObjectConfig{
		Name: "Field",
		Fields: graphql.Fields{
			"type": &graphql.Field{
				Type:        graphql.NewNonNull(cxt.ValueTypeEnum()),
				Description: "field type",
				Resolve: func(p graphql.ResolveParams) (interface{}, error) {
					if fd, ok := p.Source.(*graph.Field); ok {
						return string(fd.Type), nil
					}
					return nil, nil
				},
			},
			"toType": &graphql.Field{
				Type:        graphql.String,
				Description: "optional type of target nodes",
				Resolve: func(p graphql.ResolveParams) (interface{}, error) {
					if fd, ok := p.Source.(*graph.Field); ok {
						if fd.ToType != nil {
							return fd.ToType.Name, nil
						}
					}
					return nil, nil
				},
			},
			"name": &graphql.Field{
				Type:        graphql.NewNonNull(graphql.String),
				Description: "field name",
			},
			"required": &graphql.Field{
				Type:        graphql.NewNonNull(graphql.Boolean),
				Description: "is field required",
			},
		},
	})
	return cxt.fieldDefinitionObject
}

func (cxt *GraphqlContext) NodeInterface() *graphql.Interface {
	if cxt.nodeInterface != nil {
		return cxt.nodeInterface
	}
	cxt.nodeInterface = graphql.NewInterface(graphql.InterfaceConfig{
		Name:        "NodeInterface",
		Description: "Generic node interface",
		Fields: graphql.Fields{
			"id": &graphql.Field{
				Type:        graphql.NewNonNull(graphql.ID),
				Description: "The id of the node",
			},
			"type": &graphql.Field{
				Type:        graphql.NewNonNull(cxt.TypeObject()),
				Description: "type definition of node",
			},
			"attrs": &graphql.Field{
				Type:        graphql.NewList(cxt.AttrObject()),
				Description: "list of node attributes as key/value pairs",
			},
		},
		ResolveType: func(p graphql.ResolveTypeParams) *graphql.Object {
			fmt.Println("types", cxt.types)
			n, ok := p.Value.(*graph.Node)
			if !ok {
				fmt.Println("failed to resolve Node type: Value was not a Node")
				panic("missing node value")
			}
			if n.Type() == nil {
				fmt.Println("node without type")
				panic("node found without type")
			}
			return cxt.types[n.Type().Name]
		},
	})
	return cxt.nodeInterface
}

func (cxt *GraphqlContext) NodeType(t *graph.Type) *graphql.Object {
	if _, exists := cxt.types[t.Name]; exists {
		return cxt.types[t.Name]
	}
	o := graphql.NewObject(graphql.ObjectConfig{
		Name: t.Name,
		Fields: graphql.Fields{
			"id": &graphql.Field{
				Type:        graphql.NewNonNull(graphql.ID),
				Description: "Unique identifier",
				Resolve: func(p graphql.ResolveParams) (interface{}, error) {
					n, ok := p.Source.(*graph.Node)
					if !ok {
						return nil, castError(p.Source, "Node")
					}
					return n.ID(), nil
				},
			},
			"type": &graphql.Field{
				Type:        graphql.NewNonNull(cxt.TypeObject()),
				Description: "type definition",
				Resolve: func(p graphql.ResolveParams) (interface{}, error) {
					n, ok := p.Source.(*graph.Node)
					if !ok {
						return nil, castError(p.Source, "Node")
					}
					return n.Type(), nil
				},
			},
			"attrs": &graphql.Field{
				Type:        graphql.NewList(cxt.AttrObject()),
				Description: "raw key/value attrs",
				Resolve: func(p graphql.ResolveParams) (interface{}, error) {
					n, ok := p.Source.(*graph.Node)
					if !ok {
						return nil, castError(p.Source, "Node")
					}
					return n.Attrs(), nil
				},
			},
		},
		Interfaces: []*graphql.Interface{
			cxt.NodeInterface(),
		},
	})
	cxt.types[t.Name] = o
	// add fields to describe the type fields (each field is like a "column")
	for _, f := range t.Fields {
		o.AddFieldConfig(f.Name, cxt.Field(f))
	}
	return o
}

const (
	Text       = "Text"
	BcryptText = "BcryptText"
	Int        = "Int"
	Float      = "Float"
	Boolean    = "Boolean"
	HasOne     = "HasOne"
	HasMany    = "HasMany"
)

func (cxt *GraphqlContext) ValueType(fd *graph.Field) graphql.Output {
	switch fd.Type {
	case Text, BcryptText:
		return graphql.String
	case Int:
		return graphql.Int
	case Float:
		return graphql.Float
	case Boolean:
		return graphql.Boolean
	case HasOne:
		if fd.ToType != nil {
			return cxt.NodeType(fd.ToType)
		}
		return cxt.NodeInterface()
	case HasMany:
		if fd.ToType != nil {
			return graphql.NewList(cxt.NodeType(fd.ToType))
		}
		return graphql.NewList(cxt.NodeInterface())
	default:
		panic(fmt.Sprintf("unknown ValueType '%s'", fd.Type))
	}
}

func (cxt *GraphqlContext) ArgType(fd *graph.Field) graphql.Output {
	switch fd.Type {
	case HasOne:
		return graphql.String
	case HasMany:
		return graphql.NewList(graphql.String)
	default:
		return cxt.ValueType(fd)
	}
}

func (cxt *GraphqlContext) Field(fd *graph.Field) *graphql.Field {
	return &graphql.Field{
		Type:        cxt.ValueType(fd),
		Description: fd.Description,
		Resolve: func(p graphql.ResolveParams) (interface{}, error) {
			n, ok := p.Source.(*graph.Node)
			if !ok {
				return nil, fmt.Errorf("failed to get field %s invalid node source: %v", fd.Name, p.Source)
			}
			switch fd.Type {
			case HasOne:
				return n.Out().Get(fd.Name).First(), nil
			case HasMany:
				return n.Out().Get(fd.Name), nil
			default:
				return n.Attr(fd.Name), nil
			}
		},
	}
}

func (cxt *GraphqlContext) TypeEnum() *graphql.Enum {
	if cxt.typeEnum != nil {
		return cxt.typeEnum
	}
	typeEnumValues := graphql.EnumValueConfigMap{}
	for _, t := range cxt.conn.g.Types() {
		typeEnumValues[t.Name] = &graphql.EnumValueConfig{
			Description: fmt.Sprintf("%s Type", t.Name),
		}
	}
	cxt.typeEnum = graphql.NewEnum(graphql.EnumConfig{
		Name:        "TypeEnum",
		Description: "Type constants",
		Values:      typeEnumValues,
	})
	return cxt.typeEnum
}

func (cxt *GraphqlContext) FieldNameEnum() *graphql.Enum {
	if cxt.fieldNameEnum != nil {
		return cxt.fieldNameEnum
	}
	values := graphql.EnumValueConfigMap{}
	for _, t := range cxt.conn.g.Types() {
		for _, fd := range t.Fields {
			if _, exists := values[fd.Name]; !exists {
				values[fd.Name] = &graphql.EnumValueConfig{
					Value: fd.Name,
				}
			}
		}
	}
	cxt.fieldNameEnum = graphql.NewEnum(graphql.EnumConfig{
		Name:        "FieldNameEnum",
		Description: "Field names",
		Values:      values,
	})
	return cxt.fieldNameEnum
}

func (cxt *GraphqlContext) DefineTypeMutation() *graphql.Field {
	return &graphql.Field{
		Description: "Create a new type",
		Type:        cxt.TypeObject(),
		Args: graphql.FieldConfigArgument{
			"name": &graphql.ArgumentConfig{
				Type: graphql.NewNonNull(graphql.String),
			},
			"fields": &graphql.ArgumentConfig{
				Type: graphql.NewList(cxt.FieldDefinitionObject()),
			},
		},
		Resolve: func(p graphql.ResolveParams) (interface{}, error) {
			name, ok := p.Args["name"].(string)
			if !ok || name == "" {
				return nil, fmt.Errorf("invalid name")
			}
			// cn := &DefineType{
			// 	Name: name,
			// }
			// if err := cxt.db.Apply(cxt.user.ID, cn); err != nil {
			// 	return nil, err
			// }
			return cxt.conn.g.Type(name), nil
		},
	}
}

func (cxt *GraphqlContext) NodeListField(t *graph.Type) *graphql.Field {
	var gqlType graphql.Type
	if t == nil {
		gqlType = cxt.NodeInterface()
	} else {
		gqlType = cxt.NodeType(t)
	}
	return &graphql.Field{
		Args: graphql.FieldConfigArgument{
			"type": &graphql.ArgumentConfig{
				Type: graphql.NewList(cxt.TypeEnum()),
			},
			"sort": &graphql.ArgumentConfig{
				Type: graphql.NewList(cxt.FieldNameEnum()),
			},
		},
		Description: "list all nodes",
		Type:        graphql.NewList(gqlType),
		Resolve: func(p graphql.ResolveParams) (interface{}, error) {
			return cxt.conn.g.Nodes(), nil
		},
	}
}

func (cxt *GraphqlContext) NodeField(t *graph.Type) *graphql.Field {
	var gqlType graphql.Type
	if t == nil {
		gqlType = cxt.NodeInterface()
	} else {
		gqlType = cxt.NodeType(t)
	}
	return &graphql.Field{
		Args: graphql.FieldConfigArgument{
			"id": &graphql.ArgumentConfig{
				Type: graphql.NewNonNull(graphql.ID),
			},
		},
		Description: "fetch any node by id",
		Type:        gqlType,
		Resolve: func(p graphql.ResolveParams) (interface{}, error) {
			id, ok := p.Args["id"].(string)
			if !ok || id == "" {
				return nil, fmt.Errorf("invalid id")
			}
			return cxt.conn.g.Get(id), nil
		},
	}
}

func (cxt *GraphqlContext) GetTypes() *graphql.Field {
	return &graphql.Field{
		Description: "list all type definition",
		Type:        graphql.NewList(cxt.TypeObject()),
		Resolve: func(p graphql.ResolveParams) (interface{}, error) {
			return cxt.conn.g.Types(), nil
		},
	}
}

func (cxt *GraphqlContext) DefineFieldMutation() *graphql.Field {
	return &graphql.Field{
		Description: "Create a new field for a type",
		Type:        cxt.FieldDefinitionObject(),
		Args: graphql.FieldConfigArgument{
			"type": &graphql.ArgumentConfig{
				Type: graphql.NewNonNull(graphql.String),
			},
			"valueType": &graphql.ArgumentConfig{
				Type: graphql.NewNonNull(graphql.String),
			},
			"name": &graphql.ArgumentConfig{
				Type: graphql.NewNonNull(graphql.String),
			},
			"toType": &graphql.ArgumentConfig{
				Type: graphql.String,
			},
		},
		Resolve: func(p graphql.ResolveParams) (interface{}, error) {
			return nil, nil // TODO!
		},
	}
}

func (cxt *GraphqlContext) SetMutation() *graphql.Field {
	argFields := graphql.FieldConfigArgument{
		"id": &graphql.ArgumentConfig{
			Type: graphql.NewNonNull(graphql.String),
		},
		"type": &graphql.ArgumentConfig{
			Type: graphql.NewNonNull(graphql.String),
		},
		"attrs": &graphql.ArgumentConfig{
			Type: graphql.NewList(graphql.NewInputObject(graphql.InputObjectConfig{
				Name: "AttrArg",
				Fields: graphql.InputObjectConfigFieldMap{
					"name": &graphql.InputObjectFieldConfig{
						Type: graphql.String,
					},
					"value": &graphql.InputObjectFieldConfig{
						Type: graphql.String,
					},
				},
			})),
		},
	}
	return &graphql.Field{
		Description: "set node data",
		Type:        cxt.NodeInterface(),
		Args:        argFields,
		Resolve: func(p graphql.ResolveParams) (interface{}, error) {
			g := cxt.conn.g
			id, ok := p.Args["id"].(string)
			if !ok {
				return nil, invalidArg("id")
			}
			if id == "" {
				return nil, invalidArg("id")
			}
			typeName, ok := p.Args["type"].(string)
			if !ok {
				return nil, invalidArg("type")
			}
			if typeName == "" {
				return nil, invalidArg("type")
			}
			t := g.Type(typeName)
			if t == nil {
				return nil, invalidArg("type")
			}
			fmt.Println("args", p.Args)
			iattrs, ok := p.Args["attrs"].([]interface{})
			if !ok {
				return nil, invalidArg("attrs")
			}
			attrs := graph.Attrs{}
			for _, iv := range iattrs {
				args, ok := iv.(map[string]interface{})
				if !ok {
					return nil, invalidArg("attrs[i]")
				}
				k, ok := args["name"].(string)
				if !ok {
					return nil, invalidArg("attrs[i].name")
				}
				if k == "" {
					return nil, fmt.Errorf("k is empty")
				}
				v, ok := args["value"].(string)
				if !ok {
					return nil, invalidArg("attrs[i].value")
				}
				attrs[k] = v
			}
			g = g.Set(graph.NodeConfig{
				ID:    id,
				Type:  t.Name,
				Attrs: attrs,
			})
			n := g.Get(id)
			if n == nil {
				return nil, fmt.Errorf("failed to create node")
			}
			cxt.conn.g = g
			return n, nil
		},
	}
}

func (cxt *GraphqlContext) AddQuery(name string, field *graphql.Field) {
	cxt.fields[name] = field
}

func (cxt *GraphqlContext) AddMutation(name string, field *graphql.Field) {
	cxt.mutations[name] = field
}

func (cxt *GraphqlContext) schema() (*graphql.Schema, error) {
	s, err := graphql.NewSchema(graphql.SchemaConfig{
		Query: graphql.NewObject(graphql.ObjectConfig{
			Name:   "RootQuery",
			Fields: cxt.fields,
		}),
		Mutation: graphql.NewObject(graphql.ObjectConfig{
			Name:   "RootMutation",
			Fields: cxt.mutations,
		}),
	})
	if err != nil {
		return nil, err
	}
	return &s, nil
}

func (cxt *GraphqlContext) Schema() (*graphql.Schema, error) {
	cxt.AddQuery("node", cxt.NodeField(nil))
	cxt.AddQuery("nodes", cxt.NodeListField(nil))
	for _, t := range cxt.conn.g.Types() {
		fmt.Println("t", t.Name)
		cxt.AddQuery(inflect.CamelizeDownFirst(inflect.Pluralize(t.Name)), cxt.NodeListField(t))
	}
	cxt.AddQuery("types", cxt.GetTypes())
	cxt.AddMutation("defineType", cxt.DefineTypeMutation())
	cxt.AddMutation("set", cxt.SetMutation())
	return cxt.schema()
}
