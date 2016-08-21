package graph

type ValueType string

const (
	Text       ValueType = "Text"
	Int                  = "Int"
	Float                = "Float"
	Boolean              = "Boolean"
	BcryptText           = "BcryptText"
	HasOne               = "HasOne"
	HasMany              = "HasMany"
)

