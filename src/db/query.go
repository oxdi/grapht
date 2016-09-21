package db

import (
	"encoding/json"
	"fmt"
	"graph"
	"reflect"
	"strings"

	"github.com/graphql-go/graphql"
)

func castError(name string, src interface{}, dst string) error {
	return fmt.Errorf("failed to cast '%s' arg '%v' to %s", name, reflect.ValueOf(src).Type().Name, dst)
}
func invalidArg(args map[string]interface{}, name string, reason string) error {
	return fmt.Errorf("argument '%s' (%v) invalid: %s", name, args[name], reason)
}
func nilSourceError(fieldName, typeName string) error {
	return fmt.Errorf("error fetching field '%s' for '%s': required source was nil", fieldName, typeName)
}

var reservedWords = []string{
	"node",
	"nodes",
	"attr",
	"attrs",
	"in",
	"out",
	"edge",
	"edges",
	"null",
	"nullnode",
	"hasone",
	"id",
}

// TODO: this is insanely lazy FIXME
func fill(dst interface{}, src interface{}) error {
	b, err := json.Marshal(src)
	if err != nil {
		return err
	}
	return json.Unmarshal(b, dst)
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
	attrInputObject       *graphql.InputObject
	imageObject           *graphql.Object
	edgeObject            *graphql.Object
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
			string(graph.Text): &graphql.EnumValueConfig{
				Description: "Generic text field",
			},
			string(graph.Int): &graphql.EnumValueConfig{
				Description: "Generic int field",
			},
			string(graph.Float): &graphql.EnumValueConfig{
				Description: "Generic float field",
			},
			string(graph.Boolean): &graphql.EnumValueConfig{
				Description: "Generic bool field",
			},
			string(graph.BcryptText): &graphql.EnumValueConfig{
				Description: "Text value that gets hashed before write",
			},
			string(graph.HasOne): &graphql.EnumValueConfig{
				Description: "Traditional has-one style relationship to another node",
			},
			string(graph.HasMany): &graphql.EnumValueConfig{
				Description: "Traditional has-many style relationship to other nodes",
			},
			string(graph.Image): &graphql.EnumValueConfig{
				Description: "Image data field",
			},
			string(graph.File): &graphql.EnumValueConfig{
				Description: "File attachment data field",
			},
		},
	})

}

func (cxt *GraphqlContext) ImageObject() *graphql.Object {
	if cxt.imageObject != nil {
		return cxt.imageObject
	}
	cxt.imageObject = graphql.NewObject(graphql.ObjectConfig{
		Name: "Img",
		Fields: graphql.Fields{
			"url": &graphql.Field{
				Args: graphql.FieldConfigArgument{
					"scheme": &graphql.ArgumentConfig{
						Type: graphql.NewEnum(graphql.EnumConfig{
							Name:        "SchemeEnum",
							Description: "url scheme",
							Values: graphql.EnumValueConfigMap{
								"DATA": &graphql.EnumValueConfig{
									Description: "data-uri url",
								},
								"HTTP": &graphql.EnumValueConfig{
									Description: "scheme relative http url",
								},
							},
						}),
					},
				},
				Type:        graphql.String,
				Description: "url to image (defaults to data-uri)",
				Resolve: func(p graphql.ResolveParams) (interface{}, error) {
					args := struct {
						Scheme string
					}{}
					if err := fill(&args, p.Args); err != nil {
						return nil, err
					}
					data, ok := p.Source.(string)
					if !ok {
						return nil, castError("url", p.Source, "string")
					}
					if args.Scheme == "HTTP" {
						return "//fixme.com/image.jpg", nil
					}
					return "data:" + data, nil
				},
			},
			"contentType": &graphql.Field{
				Type:        graphql.String,
				Description: "content type of image",
				Resolve: func(p graphql.ResolveParams) (interface{}, error) {
					data, ok := p.Source.(string)
					if !ok {
						return nil, castError("url", p.Source, "string")
					}
					parts := strings.Split(data, ",")
					if len(parts) == 0 {
						return nil, nil
					}
					parts = strings.Split(parts[0], ";")
					if len(parts) == 0 {
						return nil, nil
					}
					return parts[0], nil
				},
			},
		},
	})
	return cxt.imageObject
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
						return nil, castError("name", p.Source, "Attr")
					}
					return attr.Name, nil
				},
			},
			"value": &graphql.Field{
				Type:        graphql.String,
				Description: "attr value in string form",
				Resolve: func(p graphql.ResolveParams) (interface{}, error) {
					attr, ok := p.Source.(*graph.Attr)
					if !ok {
						return nil, castError("value", p.Source, "Attr")
					}
					return attr.Value, nil
				},
			},
			"encoding": &graphql.Field{
				Type:        graphql.String,
				Description: "how the attr value is encoded",
				Resolve: func(p graphql.ResolveParams) (interface{}, error) {
					attr, ok := p.Source.(*graph.Attr)
					if !ok {
						return nil, castError("encoding", p.Source, "Attr")
					}
					return attr.Encoding, nil
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
						if fd.ToType != "" {
							return fd.ToType, nil
						}
					}
					return nil, nil
				},
			},
			"edge": &graphql.Field{
				Type:        graphql.String,
				Description: "optional name of edge to follow",
				Resolve: func(p graphql.ResolveParams) (interface{}, error) {
					if fd, ok := p.Source.(*graph.Field); ok {
						return fd.Edge, nil
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
		Fields:      graphql.Fields{},
		ResolveType: func(p graphql.ResolveTypeParams) *graphql.Object {
			n, ok := p.Value.(*graph.Node)
			if !ok {
				return nil
			}
			if n == nil {
				return nil
			}
			if n.Type() == nil {
				return nil
			}
			return cxt.NodeType(n.Type())
		},
	})
	cxt.nodeInterface.AddFieldConfig("id", &graphql.Field{
		Type:        graphql.NewNonNull(graphql.ID),
		Description: "The id of the node",
	})
	cxt.nodeInterface.AddFieldConfig("type", &graphql.Field{
		Type:        graphql.NewNonNull(cxt.TypeObject()),
		Description: "type definition of node",
	})
	cxt.nodeInterface.AddFieldConfig("attrs", &graphql.Field{
		Type:        graphql.NewList(cxt.AttrObject()),
		Description: "list of node attributes as key/value pairs",
	})
	cxt.nodeInterface.AddFieldConfig("edges", &graphql.Field{
		Type: graphql.NewList(cxt.EdgeType()),
		Args: graphql.FieldConfigArgument{
			"name": &graphql.ArgumentConfig{
				Type: graphql.String,
			},
			"dir": &graphql.ArgumentConfig{
				Type: graphql.String,
			},
		},
		Description: "list inbound/outbound edges",
	})
	cxt.nodeInterface.AddFieldConfig("out", &graphql.Field{
		Type: graphql.NewList(cxt.NodeInterface()),
		Args: graphql.FieldConfigArgument{
			"name": &graphql.ArgumentConfig{
				Type: graphql.String,
			},
		},
		Description: "outbound connected nodes",
	})
	cxt.nodeInterface.AddFieldConfig("in", &graphql.Field{
		Type: graphql.NewList(cxt.NodeInterface()),
		Args: graphql.FieldConfigArgument{
			"name": &graphql.ArgumentConfig{
				Type: graphql.String,
			},
		},
		Description: "inbound connected nodes",
	})
	return cxt.nodeInterface
}

func (cxt *GraphqlContext) EdgeType() *graphql.Object {
	if cxt.edgeObject != nil {
		return cxt.edgeObject
	}
	cxt.edgeObject = graphql.NewObject(graphql.ObjectConfig{
		Name:   "Edge",
		Fields: graphql.Fields{},
	})
	cxt.edgeObject.AddFieldConfig("to", &graphql.Field{
		Type:        graphql.NewNonNull(cxt.NodeInterface()),
		Description: "destination node",
		Resolve: func(p graphql.ResolveParams) (interface{}, error) {
			e, ok := p.Source.(*graph.Edge)
			if !ok {
				return nil, castError("to", p.Source, "Edge")
			}
			return e.To(), nil
		},
	})
	cxt.edgeObject.AddFieldConfig("from", &graphql.Field{
		Type:        graphql.NewNonNull(cxt.NodeInterface()),
		Description: "source node",
		Resolve: func(p graphql.ResolveParams) (interface{}, error) {
			e, ok := p.Source.(*graph.Edge)
			if !ok {
				return nil, castError("from", p.Source, "Edge")
			}
			return e.From(), nil
		},
	})
	cxt.edgeObject.AddFieldConfig("node", &graphql.Field{
		Type:        graphql.NewNonNull(cxt.NodeInterface()),
		Description: "source node",
		Resolve: func(p graphql.ResolveParams) (interface{}, error) {
			e, ok := p.Source.(*graph.Edge)
			if !ok {
				return nil, castError("node", p.Source, "Edge")
			}
			return e.Node(), nil
		},
	})
	cxt.edgeObject.AddFieldConfig("name", &graphql.Field{
		Type:        graphql.NewNonNull(graphql.String),
		Description: "connection name",
		Resolve: func(p graphql.ResolveParams) (interface{}, error) {
			e, ok := p.Source.(*graph.Edge)
			if !ok {
				return nil, castError("name", p.Source, "Edge")
			}
			return e.Name(), nil
		},
	})
	return cxt.edgeObject
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
						return nil, castError("id", p.Source, "Node")
					}
					if n == nil {
						return "", nilSourceError("id", t.Name)
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
						return nil, castError("type", p.Source, "Node")
					}
					if n == nil {
						return nil, nilSourceError("type", t.Name)
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
						return nil, castError("attrs", p.Source, "Node")
					}
					if n == nil {
						return nil, nilSourceError("attrs", t.Name)
					}
					return n.Attrs(), nil
				},
			},
			"edges": &graphql.Field{
				Type: graphql.NewList(cxt.EdgeType()),
				Args: graphql.FieldConfigArgument{
					"name": &graphql.ArgumentConfig{
						Type: graphql.String,
					},
					"dir": &graphql.ArgumentConfig{
						Type: graphql.String,
					},
				},
				Description: "outbound connected nodes",
				Resolve: func(p graphql.ResolveParams) (interface{}, error) {
					n, ok := p.Source.(*graph.Node)
					if !ok {
						return nil, castError("out", p.Source, "Node")
					}
					if n == nil {
						return nil, nilSourceError("edges", t.Name)
					}
					edgeName, _ := p.Args["name"].(string)
					edgeDir, _ := p.Args["dir"].(string)
					return n.Edges(edgeName, edgeDir), nil
				},
			},
			"out": &graphql.Field{
				Type: graphql.NewList(cxt.NodeInterface()),
				Args: graphql.FieldConfigArgument{
					"name": &graphql.ArgumentConfig{
						Type: graphql.String,
					},
				},
				Description: "outbound connected nodes",
				Resolve: func(p graphql.ResolveParams) (interface{}, error) {
					n, ok := p.Source.(*graph.Node)
					if !ok {
						return nil, castError("out", p.Source, "Node")
					}
					if n == nil {
						return nil, nilSourceError("out", t.Name)
					}
					edgeName, _ := p.Args["name"].(string)
					return n.Out(edgeName).Nodes(), nil
				},
			},
			"in": &graphql.Field{
				Type: graphql.NewList(cxt.NodeInterface()),
				Args: graphql.FieldConfigArgument{
					"name": &graphql.ArgumentConfig{
						Type: graphql.String,
					},
				},
				Description: "inbound connected nodes",
				Resolve: func(p graphql.ResolveParams) (interface{}, error) {
					n, ok := p.Source.(*graph.Node)
					if !ok {
						return nil, castError("in", p.Source, "Node")
					}
					if n == nil {
						return nil, nilSourceError("in", t.Name)
					}
					edgeName, _ := p.Args["name"].(string)
					return n.In(edgeName).Nodes(), nil
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

func (cxt *GraphqlContext) ValueType(fd *graph.Field) graphql.Output {
	switch fd.Type {
	case graph.Text, graph.BcryptText:
		return graphql.String
	case graph.Int:
		return graphql.Int
	case graph.Float:
		return graphql.Float
	case graph.Boolean:
		return graphql.Boolean
	case graph.Image:
		return cxt.ImageObject()
	case graph.HasOne:
		if fd.ToType != "" {
			t := cxt.conn.g.Type(fd.ToType)
			if t != nil {
				return cxt.NodeType(t)
			}
		}
		return cxt.NodeInterface()
	case graph.HasMany:
		if fd.ToType != "" {
			t := cxt.conn.g.Type(fd.ToType)
			if t != nil {
				return graphql.NewList(cxt.NodeType(t))
			}
		}
		return graphql.NewList(cxt.NodeInterface())
	default:
		panic(fmt.Sprintf("unknown ValueType '%s'", fd.Type))
	}
}

func (cxt *GraphqlContext) ArgType(fd *graph.Field) graphql.Output {
	switch fd.Type {
	case graph.HasOne:
		return graphql.String
	case graph.HasMany:
		return graphql.NewList(graphql.String)
	default:
		return cxt.ValueType(fd)
	}
}

func (cxt *GraphqlContext) ImageField(f *graph.Field) *graphql.Field {
	return &graphql.Field{
		Args: graphql.FieldConfigArgument{
			"width": &graphql.ArgumentConfig{
				Type: graphql.Int,
			},
			"height": &graphql.ArgumentConfig{
				Type: graphql.Int,
			},
		},
		Type:        cxt.ImageObject(),
		Description: f.Description,
		Resolve: func(p graphql.ResolveParams) (interface{}, error) {
			n, ok := p.Source.(*graph.Node)
			if !ok {
				return nil, fmt.Errorf("failed to get field %s invalid node source: %v", f.Name, p.Source)
			}
			if n == nil {
				return nil, nilSourceError(f.Name, "<unknown>")
			}
			cfg := ResizeConfig{}
			if err := fill(&cfg, p.Args); err != nil {
				return nil, err
			}
			data := n.Attr(f.Name)
			if cfg.Width != 0 || cfg.Height != 0 {
				img, err := decodeImageDataURI(data)
				if err != nil {
					return nil, err
				}
				img = resizeImage(img, &cfg)
				return encodeImageDataURI(img)
			}
			return data, nil
		},
	}
}

func (cxt *GraphqlContext) Field(f *graph.Field) *graphql.Field {
	if f.Type == graph.Image {
		return cxt.ImageField(f)
	}
	return &graphql.Field{
		Type:        cxt.ValueType(f),
		Description: f.Description,
		Resolve: func(p graphql.ResolveParams) (interface{}, error) {
			n, ok := p.Source.(*graph.Node)
			if !ok {
				return nil, fmt.Errorf("failed to get field %s invalid node source: %v", f.Name, p.Source)
			}
			if n == nil {
				return nil, nilSourceError(f.Name, "<unknown>")
			}
			switch f.Type {
			case graph.HasOne:
				var edgeNames []string
				if f.Edge != "" {
					edgeNames = append(edgeNames, f.Edge)
				}
				node := n.Out(edgeNames...).Nodes().First()
				if node == nil {
					return nil, nil
				}
				return node, nil
			case graph.HasMany:
				var edgeNames []string
				if f.Edge != "" {
					edgeNames = append(edgeNames, f.Edge)
				}
				return n.In(edgeNames...).Nodes(), nil
			default:
				return n.Attr(f.Name), nil
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
				Type: graphql.NewList(graphql.NewInputObject(graphql.InputObjectConfig{
					Name: "FieldArg",
					Fields: graphql.InputObjectConfigFieldMap{
						"name": &graphql.InputObjectFieldConfig{
							Type: graphql.NewNonNull(graphql.String),
						},
						"type": &graphql.InputObjectFieldConfig{
							Type: graphql.NewNonNull(graphql.String),
						},
						"edge": &graphql.InputObjectFieldConfig{
							Type: graphql.String,
						},
						"toType": &graphql.InputObjectFieldConfig{
							Type: graphql.String,
						},
					},
				})),
			},
		},
		Resolve: func(p graphql.ResolveParams) (interface{}, error) {
			args := struct {
				Name   string
				Fields []struct {
					Name   string
					Type   string
					Edge   string
					ToType string
				}
			}{}
			if err := fill(&args, p.Args); err != nil {
				return nil, err
			}
			t := &graph.Type{Name: args.Name}
			for _, fa := range args.Fields {
				t.Fields = append(t.Fields, &graph.Field{
					Name:   fa.Name,
					Type:   fa.Type,
					Edge:   fa.Edge,
					ToType: fa.ToType,
				})
			}
			g := cxt.conn.g
			g = g.DefineType(*t)
			t = g.Type(args.Name)
			if t == nil {
				return nil, fmt.Errorf("failed to create type")
			}
			cxt.conn.update(g)
			return t, nil
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
			args := struct {
				Type []string
				Sort []string
			}{}
			if err := fill(&args, p.Args); err != nil {
				return nil, err
			}
			ns := cxt.conn.g.Nodes()
			ns = ns.FilterType(args.Type...)
			// ns = ns.Sort(args.Sort)
			return ns, nil
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

func (cxt *GraphqlContext) GetType() *graphql.Field {
	return &graphql.Field{
		Args: graphql.FieldConfigArgument{
			"name": &graphql.ArgumentConfig{
				Type: graphql.NewNonNull(graphql.String),
			},
		},
		Description: "fetch single type by name",
		Type:        cxt.TypeObject(),
		Resolve: func(p graphql.ResolveParams) (interface{}, error) {
			name, ok := p.Args["name"].(string)
			if !ok || name == "" {
				return nil, fmt.Errorf("invalid name arg")
			}
			return cxt.conn.g.Type(name), nil
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

func (cxt *GraphqlContext) DisconnectMutation() *graphql.Field {
	return &graphql.Field{
		Description: "set node data",
		Type:        graphql.NewList(cxt.EdgeType()),
		Args: graphql.FieldConfigArgument{
			"name": &graphql.ArgumentConfig{
				Type: graphql.String,
			},
			"from": &graphql.ArgumentConfig{
				Type: graphql.String,
			},
			"to": &graphql.ArgumentConfig{
				Type: graphql.String,
			},
		},
		Resolve: func(p graphql.ResolveParams) (interface{}, error) {
			match := graph.EdgeMatch{}
			err := fill(&match, p.Args)
			if err != nil {
				return nil, err
			}
			g := cxt.conn.g
			edges := g.Edges(match)
			g = g.Disconnect(match)
			cxt.conn.update(g)
			return edges, nil
		},
	}
}
func (cxt *GraphqlContext) ConnectMutation() *graphql.Field {
	return &graphql.Field{
		Description: "set node data",
		Type:        cxt.EdgeType(),
		Args: graphql.FieldConfigArgument{
			"name": &graphql.ArgumentConfig{
				Type: graphql.NewNonNull(graphql.String),
			},
			"from": &graphql.ArgumentConfig{
				Type: graphql.NewNonNull(graphql.String),
			},
			"to": &graphql.ArgumentConfig{
				Type: graphql.NewNonNull(graphql.String),
			},
		},
		Resolve: func(p graphql.ResolveParams) (interface{}, error) {
			cfg := graph.EdgeConfig{}
			err := fill(&cfg, p.Args)
			if err != nil {
				return nil, err
			}
			g := cxt.conn.g
			from := g.Get(cfg.From)
			if from == nil {
				return nil, fmt.Errorf("from node '%s' did not exist", cfg.From)
			}
			to := g.Get(cfg.To)
			if to == nil {
				return nil, fmt.Errorf("to node '%s' did not exist", cfg.To)
			}
			if cfg.Name == "" {
				return nil, fmt.Errorf("connection name cannot be blank")
			}
			g = g.Connect(cfg)
			edge := g.Edges(graph.EdgeMatch{
				From: cfg.From,
				To:   cfg.To,
				Name: cfg.Name,
			}).First()
			if edge == nil {
				return nil, fmt.Errorf("failed to create edge")
			}
			cxt.conn.update(g)
			return edge, nil
		},
	}
}
func (cxt *GraphqlContext) RemoveMutation() *graphql.Field {
	return &graphql.Field{
		Description: "delete a node",
		Type:        cxt.NodeInterface(),
		Args: graphql.FieldConfigArgument{
			"id": &graphql.ArgumentConfig{
				Type: graphql.NewNonNull(graphql.String),
			},
		},
		Resolve: func(p graphql.ResolveParams) (interface{}, error) {
			cfg := graph.NodeConfig{}
			err := fill(&cfg, p.Args)
			if err != nil {
				return nil, err
			}
			g := cxt.conn.g
			n := g.Get(cfg.ID)
			if n == nil {
				return nil, fmt.Errorf("node already removed")
			}
			g = g.Remove(cfg.ID)
			cxt.conn.update(g)
			return n, nil
		},
	}
}
func (cxt *GraphqlContext) MergeMutation() *graphql.Field {
	return &graphql.Field{
		Description: "set node data",
		Type:        cxt.NodeInterface(),
		Args: graphql.FieldConfigArgument{
			"id": &graphql.ArgumentConfig{
				Type: graphql.NewNonNull(graphql.String),
			},
			"attrs": &graphql.ArgumentConfig{
				Type: graphql.NewList(cxt.AttrInputObject()),
			},
		},
		Resolve: func(p graphql.ResolveParams) (interface{}, error) {
			cfg := graph.NodeConfig{}
			err := fill(&cfg, p.Args)
			if err != nil {
				return nil, err
			}
			g := cxt.conn.g
			target := g.Get(cfg.ID)
			if target == nil {
				return nil, fmt.Errorf("cannot merge non existant node")
			}
			t := target.Type()
			if t == nil {
				return nil, fmt.Errorf("type %s is not defined", cfg.Type)
			}
			getField := func(name string) *graph.Field {
				for _, field := range t.Fields {
					if field.Name == name {
						return field
					}
				}
				return nil
			}
			for _, attr := range cfg.Attrs {
				f := getField(attr.Name)
				if f == nil {
					return nil, fmt.Errorf("cannot set attr %s type %s does not define a field called %s", attr.Name, t.Name, attr.Name)
				}
			}
			g = g.Merge(cfg)
			n := g.Get(cfg.ID)
			if n == nil {
				return nil, fmt.Errorf("failed to create node")
			}
			cxt.conn.update(g)
			return n, nil
		},
	}
}

func (cxt *GraphqlContext) AttrInputObject() *graphql.InputObject {
	if cxt.attrInputObject != nil {
		return cxt.attrInputObject
	}
	cxt.attrInputObject = graphql.NewInputObject(graphql.InputObjectConfig{
		Name: "AttrArg",
		Fields: graphql.InputObjectConfigFieldMap{
			"name": &graphql.InputObjectFieldConfig{
				Type: graphql.NewNonNull(graphql.String),
			},
			"value": &graphql.InputObjectFieldConfig{
				Type: graphql.NewNonNull(graphql.String),
			},
			"encoding": &graphql.InputObjectFieldConfig{
				Type: graphql.NewNonNull(graphql.String),
			},
		},
	})
	return cxt.attrInputObject
}

func (cxt *GraphqlContext) SetMutation() *graphql.Field {
	return &graphql.Field{
		Description: "set node data",
		Type:        cxt.NodeInterface(),
		Args: graphql.FieldConfigArgument{
			"id": &graphql.ArgumentConfig{
				Type: graphql.NewNonNull(graphql.String),
			},
			"type": &graphql.ArgumentConfig{
				Type: graphql.NewNonNull(graphql.String),
			},
			"attrs": &graphql.ArgumentConfig{
				Type: graphql.NewList(cxt.AttrInputObject()),
			},
		},
		Resolve: func(p graphql.ResolveParams) (interface{}, error) {
			cfg := graph.NodeConfig{}
			err := fill(&cfg, p.Args)
			if err != nil {
				return nil, err
			}
			g := cxt.conn.g
			t := g.Type(cfg.Type)
			if t == nil {
				return nil, fmt.Errorf("type %s is not defined", cfg.Type)
			}
			getField := func(name string) *graph.Field {
				for _, field := range t.Fields {
					if field.Name == name {
						return field
					}
				}
				return nil
			}
			for _, attr := range cfg.Attrs {
				f := getField(attr.Name)
				if f == nil {
					return nil, fmt.Errorf("cannot set attr %s type %s does not define a field called %s", attr.Name, t.Name, attr.Name)
				}
			}
			g = g.Set(cfg)
			n := g.Get(cfg.ID)
			if n == nil {
				return nil, fmt.Errorf("failed to create node")
			}
			cxt.conn.update(g)
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
	cfg := graphql.SchemaConfig{
		Query: graphql.NewObject(graphql.ObjectConfig{
			Name:   "RootQuery",
			Fields: cxt.fields,
		}),
		Mutation: graphql.NewObject(graphql.ObjectConfig{
			Name:   "RootMutation",
			Fields: cxt.mutations,
		}),
		Types: []graphql.Type{},
	}
	for _, t := range cxt.conn.g.Types() {
		cfg.Types = append(cfg.Types, cxt.NodeType(t))
	}
	s, err := graphql.NewSchema(cfg)
	if err != nil {
		return nil, err
	}
	return &s, nil
}

func (cxt *GraphqlContext) Schema() (*graphql.Schema, error) {
	// for _, t := range cxt.conn.g.Types() {
	// 	cxt.AddQuery(inflect.CamelizeDownFirst(inflect.Pluralize(t.Name)), cxt.NodeListField(t))
	// }
	cxt.AddQuery("node", cxt.NodeField(nil))
	cxt.AddQuery("nodes", cxt.NodeListField(nil))
	cxt.AddQuery("type", cxt.GetType())
	cxt.AddQuery("types", cxt.GetTypes())
	cxt.AddMutation("setType", cxt.DefineTypeMutation())
	cxt.AddMutation("setNode", cxt.SetMutation())
	cxt.AddMutation("mergeNode", cxt.MergeMutation())
	cxt.AddMutation("removeNodes", cxt.RemoveMutation())
	cxt.AddMutation("setEdge", cxt.ConnectMutation())
	cxt.AddMutation("removeEdges", cxt.DisconnectMutation())
	return cxt.schema()
}
