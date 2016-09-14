default: all

PWD := $(shell pwd)
BIN := $(PWD)/bin
export PATH := $(BIN):$(PATH)
export GOPATH := $(PWD)
GO := go
GO_SRC_FILES := $(shell find src -type f -name '*.go')

bin/grapht: $(GO_SRC_FILES)
	$(GO) build -o $@ grapht

test: bin/grapht
	# $(GO) test -v graph
	# $(GO) test -v db
	(cd src/js/grapht && ./test/runner.sh)

clean:
	rm -f bin/grapht

all: bin/grapht

.PHONY: all default clean clean-all test
