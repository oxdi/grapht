package testutil

import (
	"fmt"
	"reflect"
	"testing"
)

type Expection struct {
	t *testing.T
	v interface{}
	n int
}

func (e *Expection) ToEqual(v interface{}) {
	if !reflect.DeepEqual(e.v, v) {
		e.err(fmt.Sprintf("expected equal\nwanted: %v\ngot: %v", v, e.v))
	}
}

func (e *Expection) ToBeNil() {
	if !reflect.ValueOf(e.v).IsNil() {
		e.err(fmt.Sprintf("expected nil\ngot: %v", e.v))
	}
}

func (e *Expection) ToNotBeNil() {
	if reflect.ValueOf(e.v).IsNil() {
		e.err(fmt.Sprintf("expected not nil\ngot: %v", e.v))
	}
}
func (e *Expection) err(msg string) {
	e.t.Fatal(fmt.Sprintf("count: %d\n%s", e.n, msg))
}

func Expect(t *testing.T) func(vs ...interface{}) *Expection {
	e := &Expection{t: t}
	return func(vs ...interface{}) *Expection {
		e.n++
		if len(vs) == 0 {
			panic("at least one thing required")
		}
		e.v = vs[0]
		return e
	}
}
