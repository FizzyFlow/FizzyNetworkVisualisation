#!/bin/bash

cd bower_components/sigma
npm install
npm run build
# remove build subfolder from gitignored, so we can publish app with rep content only
sed -i '/build/d' .gitignore 
