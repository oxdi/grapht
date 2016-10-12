package db

import (
	"encoding/json"
	"fmt"
	"graph"
	"reflect"
	"regexp"
	"sort"
	"strings"
	"time"

	"github.com/graphql-go/graphql"
)

// Field Types
const (
	Text      = "Text"
	RichText  = "RichText"
	Int       = "Int"
	Float     = "Float"
	Boolean   = "Boolean"
	Edge      = "Edge"
	DataTable = "DataTable"
	File      = "File"
	Image     = "Image"
)

// Field EdgeDirection
const (
	In  = "In"
	Out = "Out"
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

var validIdent = regexp.MustCompile(`^[_a-zA-Z][_a-zA-Z0-9]*$`)
var validFieldType = regexp.MustCompile(`^(Text|RichText|Int|Float|Boolean|Edge|File|Image)$`)
var validEdgeDirection = regexp.MustCompile(`^(In|Out)$`)
var validEncType = regexp.MustCompile(`^(UTF8|DataURI|JSON)$`)

var reservedWords = []string{
	"node",
	"nodes",
	"attr",
	"attrs",
	"in",
	"out",
	"inbound",
	"outbound",
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

type Connection struct {
	Edge      *graph.Edge
	Direction string
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
	mutationObject        *graphql.Object
	connectionObject      *graphql.Object
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
			"id": &graphql.Field{
				Type:        graphql.NewNonNull(graphql.String),
				Description: "id of type",
			},
			"name": &graphql.Field{
				Type:        graphql.String,
				Description: "name of type",
			},
		},
	})
	cxt.typeDefinitionObject.AddFieldConfig("fields", &graphql.Field{
		Type:        graphql.NewList(cxt.FieldDefinitionObject()),
		Description: "field descriptions for this type",
		Resolve: func(p graphql.ResolveParams) (interface{}, error) {
			if t, ok := p.Source.(*graph.Type); ok {
				return t.Fields, nil
			}
			return []interface{}{}, nil
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
			string(RichText): &graphql.EnumValueConfig{
				Description: "Rich text field",
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
			string(Edge): &graphql.EnumValueConfig{
				Description: "Connection to another node",
			},
			string(Image): &graphql.EnumValueConfig{
				Description: "Image data field",
			},
			string(File): &graphql.EnumValueConfig{
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
						return "", nil
					}
					return attr.Value, nil
				},
			},
			"enc": &graphql.Field{
				Type:        graphql.String,
				Description: "how the attr value is encoded",
				Resolve: func(p graphql.ResolveParams) (interface{}, error) {
					attr, ok := p.Source.(*graph.Attr)
					if !ok {
						return nil, castError("enc", p.Source, "Attr")
					}
					return attr.Enc, nil
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
			"name": &graphql.Field{
				Type:        graphql.NewNonNull(graphql.String),
				Description: "field name",
			},
			"type": &graphql.Field{
				Type:        graphql.NewNonNull(cxt.ValueTypeEnum()),
				Description: "field type",
				Resolve: func(p graphql.ResolveParams) (interface{}, error) {
					fd, ok := p.Source.(*graph.Field)
					if !ok {
						return nil, nil
					}
					return string(fd.Type), nil
				},
			},
			"required": &graphql.Field{
				Type:        graphql.NewNonNull(graphql.Boolean),
				Description: "is field required",
			},
			"unit": &graphql.Field{
				Type:        graphql.String,
				Description: "SI unit of field value",
			},
			"hint": &graphql.Field{
				Type:        graphql.String,
				Description: "helpful info",
			},
			"friendlyName": &graphql.Field{
				Type:        graphql.String,
				Description: "the name to show the public",
				Resolve: func(p graphql.ResolveParams) (interface{}, error) {
					fd, ok := p.Source.(*graph.Field)
					if !ok {
						return fd.Name, nil
					}
					if fd.FriendlyName == "" {
						return fd.Name, nil
					}
					return fd.FriendlyName, nil
				},
			},
			"edgeToTypeID": &graphql.Field{
				Type:        graphql.String,
				Description: "id of target Type",
				Resolve: func(p graphql.ResolveParams) (interface{}, error) {
					fd, ok := p.Source.(*graph.Field)
					if !ok {
						return nil, nil
					}
					if fd.EdgeToTypeID == "" {
						return nil, nil
					}
					return fd.EdgeToTypeID, nil
				},
			},
			"edgeToType": &graphql.Field{
				Type:        cxt.TypeObject(),
				Description: "optional type of target nodes",
				Resolve: func(p graphql.ResolveParams) (interface{}, error) {
					fd, ok := p.Source.(*graph.Field)
					if !ok {
						return nil, nil
					}
					if fd.EdgeToTypeID == "" {
						return nil, nil
					}
					t := cxt.conn.g.TypeByID(fd.EdgeToTypeID)
					return t, nil
				},
			},
			"edgeName": &graphql.Field{
				Type:        graphql.String,
				Description: "optional name of edge to follow",
				Resolve: func(p graphql.ResolveParams) (interface{}, error) {
					fd, ok := p.Source.(*graph.Field)
					if !ok {
						return nil, nil
					}
					if fd.EdgeName == "" {
						return nil, nil
					}
					return fd.EdgeName, nil
				},
			},
			"edgeDirection": &graphql.Field{
				Type:        graphql.String,
				Description: "optional direction of edge to follow",
				Resolve: func(p graphql.ResolveParams) (interface{}, error) {
					fd, ok := p.Source.(*graph.Field)
					if !ok {
						return nil, nil
					}
					if fd.EdgeDirection == "" {
						return nil, nil
					}
					return fd.EdgeDirection, nil
				},
			},
			"textMarkup": &graphql.Field{
				Type:        graphql.String,
				Description: "is this field marked up with special formating",
				Resolve: func(p graphql.ResolveParams) (interface{}, error) {
					fd, ok := p.Source.(*graph.Field)
					if !ok {
						return nil, nil
					}
					return fd.TextMarkup, nil
				},
			},
			"textLines": &graphql.Field{
				Type:        graphql.Int,
				Description: "number of lines to show for field 0=1",
				Resolve: func(p graphql.ResolveParams) (interface{}, error) {
					fd, ok := p.Source.(*graph.Field)
					if !ok {
						return 1, nil
					}
					lines := fd.TextLines
					if lines <= 0 {
						return 1, nil
					}
					return lines, nil
				},
			},
			"textLineLimit": &graphql.Field{
				Type:        graphql.Int,
				Description: "limit number of lines 0=limit-to-textLines",
				Resolve: func(p graphql.ResolveParams) (interface{}, error) {
					fd, ok := p.Source.(*graph.Field)
					if !ok {
						return nil, nil
					}
					return fd.TextLineLimit, nil
				},
			},
			"textCharLimit": &graphql.Field{
				Type:        graphql.Int,
				Description: "limit number of characters 0=nolimit",
				Resolve: func(p graphql.ResolveParams) (interface{}, error) {
					fd, ok := p.Source.(*graph.Field)
					if !ok {
						return nil, nil
					}
					return fd.TextCharLimit, nil
				},
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
	cxt.nodeInterface.AddFieldConfig("name", &graphql.Field{
		Type:        graphql.String,
		Description: "Name attr if available or ID if not",
	})
	cxt.nodeInterface.AddFieldConfig("type", &graphql.Field{
		Type:        graphql.NewNonNull(cxt.TypeObject()),
		Description: "type definition of node",
	})
	cxt.nodeInterface.AddFieldConfig("attrs", &graphql.Field{
		Type:        graphql.NewList(cxt.AttrObject()),
		Description: "list of node attributes as key/value pairs",
	})
	cxt.nodeInterface.AddFieldConfig("connections", &graphql.Field{
		Type: graphql.NewList(cxt.ConnectionObject()),
		Args: graphql.FieldConfigArgument{
			"name": &graphql.ArgumentConfig{
				Type: graphql.String,
			},
			"direction": &graphql.ArgumentConfig{
				Type: graphql.String,
			},
		},
		Description: "list inbound/outbound edges",
	})
	return cxt.nodeInterface
}

func (cxt *GraphqlContext) ConnectionObject() *graphql.Object {
	if cxt.connectionObject != nil {
		return cxt.connectionObject
	}
	cxt.connectionObject = graphql.NewObject(graphql.ObjectConfig{
		Name:   "Connection",
		Fields: graphql.Fields{},
	})
	cxt.connectionObject.AddFieldConfig("node", &graphql.Field{
		Type:        graphql.NewNonNull(cxt.NodeInterface()),
		Description: "connected node",
		Resolve: func(p graphql.ResolveParams) (interface{}, error) {
			c, ok := p.Source.(*Connection)
			if !ok {
				return nil, castError("node", p.Source, "*Connection")
			}
			if c.Direction == Out {
				return c.Edge.To(), nil
			} else {
				return c.Edge.From(), nil
			}
		},
	})
	cxt.connectionObject.AddFieldConfig("direction", &graphql.Field{
		Type:        graphql.NewNonNull(graphql.String),
		Description: "direction of connecting edge",
		Resolve: func(p graphql.ResolveParams) (interface{}, error) {
			c, ok := p.Source.(*Connection)
			if !ok {
				return nil, castError("direction", p.Source, "*Connection")
			}
			return c.Direction, nil
		},
	})
	cxt.connectionObject.AddFieldConfig("name", &graphql.Field{
		Type:        graphql.NewNonNull(graphql.String),
		Description: "name of connecting edge",
		Resolve: func(p graphql.ResolveParams) (interface{}, error) {
			c, ok := p.Source.(*Connection)
			if !ok {
				return nil, castError("name", p.Source, "*Connection")
			}
			return c.Edge.Name(), nil
		},
	})
	return cxt.connectionObject
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
			"name": &graphql.Field{
				Type:        graphql.String,
				Description: "Name attr if available or ID if not",
				Resolve: func(p graphql.ResolveParams) (interface{}, error) {
					n, ok := p.Source.(*graph.Node)
					if !ok {
						return nil, castError("id", p.Source, "Node")
					}
					if n == nil {
						return "", nilSourceError("id", t.Name)
					}
					nameAttr := n.Attr("name")
					if nameAttr != nil && nameAttr.Value != "" {
						return nameAttr.Value, nil
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
			"connections": &graphql.Field{
				Type: graphql.NewList(cxt.ConnectionObject()),
				Args: graphql.FieldConfigArgument{
					"name": &graphql.ArgumentConfig{
						Type: graphql.String,
					},
					"direction": &graphql.ArgumentConfig{
						Type: graphql.String,
					},
				},
				Description: "all connections",
				Resolve: func(p graphql.ResolveParams) (interface{}, error) {
					n, ok := p.Source.(*graph.Node)
					if !ok {
						return nil, castError("edges", p.Source, "Node")
					}
					if n == nil {
						return nil, nilSourceError("edges", t.Name)
					}
					edgeName, _ := p.Args["name"].(string)
					edgeNames := []string{}
					if edgeName != "" {
						edgeNames = append(edgeNames, edgeName)
					}
					edgeDir, _ := p.Args["direction"].(string)
					edges := n.Edges(edgeNames, edgeDir)
					connections := []*Connection{}
					for _, e := range edges {
						c := &Connection{
							Edge: e,
						}
						if e.To().ID() == n.ID() {
							c.Direction = In
						} else {
							c.Direction = Out
						}
						connections = append(connections, c)
					}
					return connections, nil
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
	case Text:
		return graphql.String
	case Int:
		return graphql.Int
	case Float:
		return graphql.Float
	case Boolean:
		return graphql.Boolean
	case Image:
		return cxt.ImageObject()
	case Edge:
		return graphql.NewList(cxt.ConnectionObject())
	case RichText:
		return graphql.String
	default:
		panic(fmt.Sprintf("unknown ValueType '%s'", fd.Type))
	}
}

func (cxt *GraphqlContext) ArgType(fd *graph.Field) graphql.Output {
	switch fd.Type {
	case Edge:
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
				return nil, nil
			}
			cfg := ResizeConfig{}
			if err := fill(&cfg, p.Args); err != nil {
				return nil, err
			}
			attr := n.Attr(f.Name)
			if attr == nil {
				return nil, nil
			}
			if attr.Enc != "DataURI" {
				return nil, fmt.Errorf("cannot decode image from %s", attr.Enc)
			}
			if cfg.Width != 0 || cfg.Height != 0 {
				img, err := decodeImageDataURI(string(attr.Value))
				if err != nil {
					return nil, err
				}
				img = resizeImage(img, &cfg)
				return encodeImageDataURI(img)
			}
			return string(attr.Value), nil
		},
	}
}

func (cxt *GraphqlContext) Field(f *graph.Field) *graphql.Field {
	if f.Type == Image {
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
			case Edge:
				var edgeNames []string
				if f.EdgeName != "" {
					edgeNames = append(edgeNames, f.EdgeName)
				}
				edges := n.Edges(edgeNames, f.EdgeDirection)
				connections := []*Connection{}
				for _, e := range edges {
					c := &Connection{
						Edge: e,
					}
					if e.To().ID() == n.ID() {
						c.Direction = In
					} else {
						c.Direction = Out
					}
					connections = append(connections, c)
				}
				return connections, nil
			default:
				attr := n.Attr(f.Name)
				if attr == nil {
					return nil, nil
				}
				return string(attr.Value), nil
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

func (cxt *GraphqlContext) SetTypeMutation() *graphql.Field {
	return &graphql.Field{
		Description: "Create a new type",
		Type:        cxt.TypeObject(),
		Args: graphql.FieldConfigArgument{
			"id": &graphql.ArgumentConfig{
				Type: graphql.NewNonNull(graphql.String),
			},
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
						"required": &graphql.InputObjectFieldConfig{
							Type: graphql.Boolean,
						},
						"unit": &graphql.InputObjectFieldConfig{
							Type: graphql.String,
						},
						"hint": &graphql.InputObjectFieldConfig{
							Type: graphql.String,
						},
						"friendlyName": &graphql.InputObjectFieldConfig{
							Type: graphql.String,
						},
						"edgeName": &graphql.InputObjectFieldConfig{
							Type: graphql.String,
						},
						"edgeDirection": &graphql.InputObjectFieldConfig{
							Type: graphql.String,
						},
						"edgeToTypeID": &graphql.InputObjectFieldConfig{
							Type: graphql.String,
						},
						"textMarkup": &graphql.InputObjectFieldConfig{
							Type: graphql.String,
						},
						"textLines": &graphql.InputObjectFieldConfig{
							Type: graphql.Int,
						},
						"textLineLimit": &graphql.InputObjectFieldConfig{
							Type: graphql.Int,
						},
						"textCharLimit": &graphql.InputObjectFieldConfig{
							Type: graphql.Int,
						},
					},
				})),
			},
		},
		Resolve: func(p graphql.ResolveParams) (interface{}, error) {
			args := struct {
				ID     string
				Name   string
				Fields []*graph.Field
			}{}
			if err := fill(&args, p.Args); err != nil {
				return nil, err
			}
			if !validIdent.MatchString(args.Name) {
				return nil, fmt.Errorf("cannot define type '%': not a valid type name")
			}
			t := &graph.Type{
				ID:   args.ID,
				Name: args.Name,
			}
			for _, fa := range args.Fields {
				if !validIdent.MatchString(fa.Name) {
					return nil, fmt.Errorf("'%s' is not a valid field name", fa.Name)
				}
				if !validFieldType.MatchString(fa.Type) {
					return nil, fmt.Errorf("'%s' is not a valid field type", fa.Type)
				}
				if fa.EdgeDirection != "" {
					if !validEdgeDirection.MatchString(fa.EdgeDirection) {
						return nil, fmt.Errorf("'%s' is not a valid field edgeDirection", fa.Type)
					}
				}
				t.Fields = append(t.Fields, fa)
			}
			g := cxt.conn.g
			g = g.DefineType(*t)
			t = g.TypeByID(args.ID)
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
			"typeID": &graphql.ArgumentConfig{
				Type: graphql.NewList(graphql.String),
			},
			"sort": &graphql.ArgumentConfig{
				Type: graphql.NewList(cxt.FieldNameEnum()),
			},
		},
		Description: "list all nodes",
		Type:        graphql.NewList(gqlType),
		Resolve: func(p graphql.ResolveParams) (interface{}, error) {
			args := struct {
				Type   []string
				TypeID []string
				Sort   []string
			}{}
			if err := fill(&args, p.Args); err != nil {
				return nil, err
			}
			ns := cxt.conn.g.Nodes()
			ts := []*graph.Type{}
			for _, typeName := range args.Type {
				t := cxt.conn.g.TypeByName(typeName)
				if t == nil {
					return nil, fmt.Errorf("'%s' is not a valid type name")
				}
				ts = append(ts, t)
			}
			for _, typeID := range args.TypeID {
				t := cxt.conn.g.TypeByID(typeID)
				if t == nil {
					return nil, fmt.Errorf("'%s' is not a valid type id")
				}
				ts = append(ts, t)
			}
			ns = ns.FilterType(ts...)
			sort.Sort(ns) // sort by id
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
			"id": &graphql.ArgumentConfig{
				Type: graphql.NewNonNull(graphql.String),
			},
		},
		Description: "fetch single type by id",
		Type:        cxt.TypeObject(),
		Resolve: func(p graphql.ResolveParams) (interface{}, error) {
			name, ok := p.Args["id"].(string)
			if !ok || name == "" {
				return nil, fmt.Errorf("invalid id arg")
			}
			t := cxt.conn.g.TypeByID(name)
			if t == nil {
				return nil, nil
			}
			return t, nil
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

func (cxt *GraphqlContext) GetEdges() *graphql.Field {
	return &graphql.Field{
		Description: "fetch edges",
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
			return edges, nil
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
				Type: graphql.String,
			},
			"enc": &graphql.InputObjectFieldConfig{
				Type: graphql.NewNonNull(graphql.String),
			},
		},
	})
	return cxt.attrInputObject
}

func (cxt *GraphqlContext) SetNodeMutation() *graphql.Field {
	return &graphql.Field{
		Description: "set node data",
		Type:        cxt.NodeInterface(),
		Args: graphql.FieldConfigArgument{
			"id": &graphql.ArgumentConfig{
				Type: graphql.NewNonNull(graphql.String),
			},
			"type": &graphql.ArgumentConfig{
				Type: graphql.String,
			},
			"typeID": &graphql.ArgumentConfig{
				Type: graphql.String,
			},
			"attrs": &graphql.ArgumentConfig{
				Type: graphql.NewList(cxt.AttrInputObject()),
			},
			"merge": &graphql.ArgumentConfig{
				Type: graphql.Boolean,
			},
		},
		Resolve: func(p graphql.ResolveParams) (interface{}, error) {
			cfg := struct {
				ID     string        `json:"id"`
				Type   string        `json:"type"`
				TypeID string        `json:"typeID"`
				Attrs  []*graph.Attr `json:"attrs"`
				Merge  bool          `json:"merge"`
			}{}
			err := fill(&cfg, p.Args)
			if err != nil {
				return nil, err
			}
			g := cxt.conn.g
			var t *graph.Type = nil
			if cfg.Type != "" {
				t = g.TypeByName(cfg.Type)
				if t == nil {
					return nil, fmt.Errorf("type '%s' is not defined", cfg.Type)
				}
			} else if cfg.TypeID != "" {
				t = g.TypeByID(cfg.TypeID)
				if t == nil {
					return nil, fmt.Errorf("type '%s' is not defined", cfg.Type)
				}
			} else if cfg.Merge {
				old := g.Get(cfg.ID)
				if old == nil {
					return nil, fmt.Errorf("cannot merge node as can't find original node and no type given")
				}
				t = old.Type()
			} else {
				return nil, fmt.Errorf("type or typeID is required")
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
				if !validEncType.MatchString(attr.Enc) {
					return nil, fmt.Errorf("cannot set field: '%s' is not a valid field enc type", attr.Enc)
				}
				if !validIdent.MatchString(attr.Name) {
					return nil, fmt.Errorf("cannot set field: '%s' is not a valid field name", attr.Name)
				}
				f := getField(attr.Name)
				if f == nil {
					return nil, fmt.Errorf("cannot set field: type '%s' does not define a field called '%s'", t.Name, attr.Name)
				}
			}
			g = g.Set(graph.NodeConfig{
				ID:    cfg.ID,
				Type:  t,
				Attrs: cfg.Attrs,
				Merge: cfg.Merge,
			})
			n := g.Get(cfg.ID)
			if n == nil {
				return nil, fmt.Errorf("failed to create node")
			}
			cxt.conn.update(g)
			return n, nil
		},
	}
}

func (cxt *GraphqlContext) MutationObject() *graphql.Object {
	if cxt.mutationObject != nil {
		return cxt.mutationObject
	}
	cxt.mutationObject = graphql.NewObject(graphql.ObjectConfig{
		Name:   "Mutation",
		Fields: graphql.Fields{},
	})
	cxt.mutationObject.AddFieldConfig("time", &graphql.Field{
		Type:        graphql.NewNonNull(graphql.String),
		Description: "time of mutation",
		Resolve: func(p graphql.ResolveParams) (interface{}, error) {
			m, ok := p.Source.(*M)
			if !ok {
				return nil, castError("time", p.Source, "*M")
			}
			return m.Timestamp, nil
		},
	})
	cxt.mutationObject.AddFieldConfig("uid", &graphql.Field{
		Type:        graphql.NewNonNull(graphql.String),
		Description: "who made the mutation",
		Resolve: func(p graphql.ResolveParams) (interface{}, error) {
			m, ok := p.Source.(*M)
			if !ok {
				return nil, castError("uid", p.Source, "*M")
			}
			uid, ok := m.Claims["uid"]
			if !ok {
				return "-", nil
			}
			return uid, nil
		},
	})
	cxt.mutationObject.AddFieldConfig("role", &graphql.Field{
		Type:        graphql.NewNonNull(graphql.String),
		Description: "who made the mutation",
		Resolve: func(p graphql.ResolveParams) (interface{}, error) {
			m, ok := p.Source.(*M)
			if !ok {
				return nil, castError("role", p.Source, "*M")
			}
			role, ok := m.Claims["role"]
			if !ok {
				return "-", nil
			}
			return role, nil
		},
	})
	cxt.mutationObject.AddFieldConfig("query", &graphql.Field{
		Type:        graphql.NewNonNull(graphql.String),
		Description: "mutation query",
		Resolve: func(p graphql.ResolveParams) (interface{}, error) {
			m, ok := p.Source.(*M)
			if !ok {
				return nil, castError("role", p.Source, "*M")
			}
			return m.Query, nil
		},
	})
	return cxt.mutationObject
}

func (cxt *GraphqlContext) GetMutations() *graphql.Field {
	return &graphql.Field{
		Description: "fetch mutation history",
		Type:        graphql.NewList(cxt.MutationObject()),
		Args: graphql.FieldConfigArgument{
			"after": &graphql.ArgumentConfig{
				Type: graphql.String,
			},
			"before": &graphql.ArgumentConfig{
				Type: graphql.String,
			},
			"first": &graphql.ArgumentConfig{
				Type: graphql.Int,
			},
		},
		Resolve: func(p graphql.ResolveParams) (interface{}, error) {
			limit := struct {
				After  *time.Time
				Before *time.Time
				First  int
			}{}
			err := fill(&limit, p.Args)
			if err != nil {
				return nil, err
			}
			mutations, err := cxt.conn.db.GetMutations(limit.After, limit.Before)
			if err != nil {
				return nil, err
			}
			out := []*M{}
			n := 10
			for i := len(mutations) - 1; i >= 0; i-- {
				n--
				if n == 0 {
					break
				}
				out = append(out, mutations[i])
			}
			return out, nil
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
	cxt.AddQuery("edges", cxt.GetEdges())
	cxt.AddQuery("type", cxt.GetType())
	cxt.AddQuery("types", cxt.GetTypes())
	cxt.AddQuery("mutations", cxt.GetMutations())
	cxt.AddMutation("setType", cxt.SetTypeMutation())
	cxt.AddMutation("setNode", cxt.SetNodeMutation())
	cxt.AddMutation("removeNodes", cxt.RemoveMutation())
	cxt.AddMutation("setEdge", cxt.ConnectMutation())
	cxt.AddMutation("removeEdges", cxt.DisconnectMutation())
	return cxt.schema()
}
