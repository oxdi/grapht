default: all

PWD := $(shell pwd)
BIN := $(PWD)/bin
export PATH := $(BIN):$(PATH)
export GOPATH := $(PWD)
GO := go
GO_SRC_FILES := $(shell find src -type f -name '*.go')
UI_SRC_FILES := $(shell find src/js/ui/src -type f)

bin/go-bindata:
	go get -u github.com/jteeuwen/go-bindata/...

bin/grapht: src/grapht/assets_gen.go $(GO_SRC_FILES)
	$(GO) build -o $@ grapht

assets/index.html.gz: src/js/ui/dist/index.html bin/go-bindata
	mkdir -p assets
	cp $< assets/index.html
	gzip -f assets/index.html

src/grapht/assets_gen.go: assets/index.html.gz
	./bin/go-bindata -prefix assets/ -debug -nocompress -nomemcopy -pkg main -o $@ assets/

src/js/ui/dist/bundle.js: $(UI_SRC_FILES)
	(cd src/js/ui && make dist/bundle.js)

src/js/ui/dist/index.html: src/js/ui/dist/bundle.js
	(cd src/js/ui && make dist/index.html)

watch: bin/grapht
	(cd src/js/ui && npm run watch 2>&1) | node watch.js

test: bin/grapht
	# $(GO) test -v graph
	# $(GO) test -v db
	(cd src/js/grapht && ./test/runner.sh)

clean:
	rm src/grapht/assets_gen.go
	rm -f bin/grapht

all: bin/grapht

.PHONY: all default clean clean-all test watch
