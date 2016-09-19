default: all

PWD := $(shell pwd)
BIN := $(PWD)/bin
export PATH := $(BIN):$(PATH)
export GOPATH := $(PWD)
GO := go
BINDATA_OPTS := -prefix assets/ -nocompress -nomemcopy -pkg main
GO_SRC_FILES := $(shell find src -type f -name '*.go')
UI_SRC_FILES := $(shell find src/js/ui/src -type f)

bin/go-bindata:
	go get -u github.com/jteeuwen/go-bindata/...

bin/grapht: src/grapht/assets_gen.go $(GO_SRC_FILES)
	$(GO) build -o $@ grapht

bin/grapht-debug: src/grapht/debug_assets_gen.go $(GO_SRC_FILES)
	$(GO) build -o $@ grapht

assets/index.html.gz: src/js/ui/dist/index.html bin/go-bindata
	mkdir -p assets
	cp $< assets/index.html
	gzip -f assets/index.html

assets/react-md.min.css.map: src/js/ui/dist/react-md.min.css.map
	cp $< $@

src/grapht/assets_gen.go: assets/index.html.gz assets/react-md.min.css.map
	rm -f src/grapht/debug_assets_gen.go
	./bin/go-bindata $(BINDATA_OPTS) -o $@ assets/

src/grapht/debug_assets_gen.go: assets/index.html.gz assets/react-md.min.css.map
	rm -f src/grapht/assets_gen.go
	./bin/go-bindata $(BINDATA_OPTS) -o $@ -debug assets/

src/js/ui/dist/bundle.js: $(UI_SRC_FILES)
	(cd src/js/ui && make dist/bundle.js)

src/js/ui/dist/index.html: src/js/ui/dist/bundle.js
	(cd src/js/ui && make dist/index.html)

watch:
	rm -f bin/grapht-debug
	rm -f assets/index.html.gz
	(cd src/js/ui && npm run watch 2>&1) | node watch.js

test: bin/grapht
	# $(GO) test -v graph
	# $(GO) test -v db
	(cd src/js/grapht && ./test/runner.sh)

clean:
	rm -f src/grapht/assets_gen.go
	rm -f bin/grapht
	(cd src/js/ui && make clean)

all: bin/grapht

.PHONY: all default clean clean-all test watch
