#!/usr/bin/env bash
rm bin/grapht; go build -o bin/grapht grapht && (cd src/js/grapht/ && npm test)
