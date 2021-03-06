"use strict";
var typescript_1 = require('typescript');
var helpers_1 = require('./helpers');
function getTypescriptSourceFile(filePath, fileContent, languageVersion, setParentNodes) {
    return typescript_1.createSourceFile(filePath, fileContent, languageVersion, setParentNodes);
}
exports.getTypescriptSourceFile = getTypescriptSourceFile;
function removeDecorators(fileName, source) {
    var sourceFile = typescript_1.createSourceFile(fileName, source, typescript_1.ScriptTarget.Latest);
    var decorators = findNodes(sourceFile, sourceFile, typescript_1.SyntaxKind.Decorator, true);
    decorators.sort(function (a, b) { return b.pos - a.pos; });
    decorators.forEach(function (d) {
        source = source.slice(0, d.pos) + source.slice(d.end);
    });
    return source;
}
exports.removeDecorators = removeDecorators;
function findNodes(sourceFile, node, kind, keepGoing) {
    if (keepGoing === void 0) { keepGoing = false; }
    if (node.kind === kind && !keepGoing) {
        return [node];
    }
    return node.getChildren(sourceFile).reduce(function (result, n) {
        return result.concat(findNodes(sourceFile, n, kind, keepGoing));
    }, node.kind === kind ? [node] : []);
}
exports.findNodes = findNodes;
function replaceNode(filePath, fileContent, node, replacement) {
    var sourceFile = getTypescriptSourceFile(filePath, fileContent, typescript_1.ScriptTarget.Latest, false);
    var startIndex = node.getStart(sourceFile);
    var endIndex = node.getEnd();
    var modifiedContent = helpers_1.rangeReplace(fileContent, startIndex, endIndex, replacement);
    return modifiedContent;
}
exports.replaceNode = replaceNode;
function removeNode(filePath, fileContent, node) {
    var sourceFile = getTypescriptSourceFile(filePath, fileContent, typescript_1.ScriptTarget.Latest, false);
    var startIndex = node.getStart(sourceFile);
    var endIndex = node.getEnd();
    var modifiedContent = helpers_1.rangeReplace(fileContent, startIndex, endIndex, '');
    return modifiedContent;
}
exports.removeNode = removeNode;
function appendAfter(source, node, toAppend) {
    return helpers_1.stringSplice(source, node.getEnd(), 0, toAppend);
}
exports.appendAfter = appendAfter;
function appendBefore(filePath, fileContent, node, toAppend) {
    var sourceFile = getTypescriptSourceFile(filePath, fileContent, typescript_1.ScriptTarget.Latest, false);
    return helpers_1.stringSplice(fileContent, node.getStart(sourceFile), 0, toAppend);
}
exports.appendBefore = appendBefore;
function insertNamedImportIfNeeded(filePath, fileContent, namedImport, fromModule) {
    var sourceFile = getTypescriptSourceFile(filePath, fileContent, typescript_1.ScriptTarget.Latest, false);
    var allImports = findNodes(sourceFile, sourceFile, typescript_1.SyntaxKind.ImportDeclaration);
    var maybeImports = allImports.filter(function (node) {
        return node.moduleSpecifier.kind === typescript_1.SyntaxKind.StringLiteral
            && node.moduleSpecifier.text === fromModule;
    }).filter(function (node) {
        // Remove import statements that are either `import 'XYZ'` or `import * as X from 'XYZ'`.
        var clause = node.importClause;
        if (!clause || clause.name || !clause.namedBindings) {
            return false;
        }
        return clause.namedBindings.kind === typescript_1.SyntaxKind.NamedImports;
    }).map(function (node) {
        return node.importClause.namedBindings;
    });
    if (maybeImports.length) {
        // There's an `import {A, B, C} from 'modulePath'`.
        // Find if it's in either imports. If so, just return; nothing to do.
        var hasImportAlready = maybeImports.some(function (node) {
            return node.elements.some(function (element) {
                return element.name.text === namedImport;
            });
        });
        if (hasImportAlready) {
            // it's already imported, so just return the original text
            return fileContent;
        }
        // Just pick the first one and insert at the end of its identifier list.
        fileContent = appendAfter(fileContent, maybeImports[0].elements[maybeImports[0].elements.length - 1], ", " + namedImport);
    }
    else {
        // Find the last import and insert after.
        fileContent = appendAfter(fileContent, allImports[allImports.length - 1], "\nimport { " + namedImport + " } from '" + fromModule + "';");
    }
    return fileContent;
}
exports.insertNamedImportIfNeeded = insertNamedImportIfNeeded;
function replaceNamedImport(filePath, fileContent, namedImportOriginal, namedImportReplacement) {
    var sourceFile = getTypescriptSourceFile(filePath, fileContent, typescript_1.ScriptTarget.Latest, false);
    var allImports = findNodes(sourceFile, sourceFile, typescript_1.SyntaxKind.ImportDeclaration);
    var modifiedContent = fileContent;
    allImports.filter(function (node) {
        if (node.importClause && node.importClause.namedBindings) {
            return node.importClause.namedBindings.kind === typescript_1.SyntaxKind.NamedImports;
        }
    }).map(function (importDeclaration) {
        return importDeclaration.importClause.namedBindings;
    }).forEach(function (namedImport) {
        return namedImport.elements.forEach(function (element) {
            if (element.name.text === namedImportOriginal) {
                modifiedContent = replaceNode(filePath, modifiedContent, element, namedImportReplacement);
            }
            ;
        });
    });
    return modifiedContent;
}
exports.replaceNamedImport = replaceNamedImport;
function replaceImportModuleSpecifier(filePath, fileContent, moduleSpecifierOriginal, moduleSpecifierReplacement) {
    var sourceFile = getTypescriptSourceFile(filePath, fileContent, typescript_1.ScriptTarget.Latest, false);
    var allImports = findNodes(sourceFile, sourceFile, typescript_1.SyntaxKind.ImportDeclaration);
    var modifiedContent = fileContent;
    allImports.forEach(function (node) {
        if (node.moduleSpecifier.kind === typescript_1.SyntaxKind.StringLiteral && node.moduleSpecifier.text === moduleSpecifierOriginal) {
            modifiedContent = replaceNode(filePath, modifiedContent, node.moduleSpecifier, "'" + moduleSpecifierReplacement + "'");
        }
    });
    return modifiedContent;
}
exports.replaceImportModuleSpecifier = replaceImportModuleSpecifier;
function checkIfFunctionIsCalled(filePath, fileContent, functionName) {
    var sourceFile = getTypescriptSourceFile(filePath, fileContent, typescript_1.ScriptTarget.Latest, false);
    var allCalls = findNodes(sourceFile, sourceFile, typescript_1.SyntaxKind.CallExpression, true);
    var functionCallList = allCalls.filter(function (call) { return call.expression && call.expression.kind === typescript_1.SyntaxKind.Identifier && call.expression.text === functionName; });
    return functionCallList.length > 0;
}
exports.checkIfFunctionIsCalled = checkIfFunctionIsCalled;
