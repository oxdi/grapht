let
  pkgs = import <nixpkgs> {};
  stdenv = pkgs.stdenv;
in rec {
  structa = stdenv.mkDerivation rec {
    name = "structa-${version}";
    version = "1.0.0";
    shellHook = ''
      export PS1="\[\e[32m\]\W ➤\[\e[m\]  "
      export GOPATH=$PWD
    '';
    buildInputs = [ pkgs.go ];
    buildPhase = ''
    '';
    installPhase = ''
      mkdir -p $out/{lib,bin}
      cp dist/lib/* $out/lib/
      cp dist/bin/* $out/bin/
    '';
  };
}
