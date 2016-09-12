#!/bin/bash
(cd ../../../ && echo '' > data/jstest && GOPATH=$(pwd) go build -o bin/grapht grapht && ./bin/grapht &) && ./node_modules/.bin/browserify test/connection_test.js| ./node_modules/.bin/tape-run | ./node_modules/.bin/colortape; kill `ps aux | grep bin/grapht | awk '{print $2}'`
