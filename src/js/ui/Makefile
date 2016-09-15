
default: dist/index.html

dist/bundle.js: package.json
	mkdir -p dist
	npm run build

dist/bundle.css: src/normalize.css src/react-md.min.css
	mkdir -p dist
	cat src/normalize.css src/react-md.min.css >$@

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
