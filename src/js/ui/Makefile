
default: dist/index.html

UI_SRC_FILES := $(shell find src -type f)

dist/bundle.js: package.json $(UI_SRC_FILES)
	mkdir -p dist
	npm run build

dist/bundle.css: src/normalize.css src/react-md.min.css
	mkdir -p dist
	cat src/normalize.css node_modules/react-md/dist/react-md.min.css >$@

dist/index.html: src/index.html dist/bundle.js dist/bundle.css
	mkdir -p dist
	cat $< >$@.tmp
	sed -i -e '/{JS}/r dist/bundle.js' $@.tmp
	sed -i -e 's/{JS}//g' $@.tmp
	sed -i -e '/{CSS}/r dist/bundle.css' $@.tmp
	sed -i -e 's/{CSS}//g' $@.tmp
	mv $@.tmp $@

clean:
	rm -f dist/*

.PHONY: clean default
