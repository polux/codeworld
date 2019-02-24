/*
 * Copyright 2019 The CodeWorld Authors. All rights reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

// This module is based on the Haskell mode from CodeMirror.
//
// CodeMirror is copyright (c) by Marijn Haverbeke and others
// Distributed under an MIT license: http://codemirror.net/LICENSE

'use strict';

CodeMirror.defineMode('codeworld', (_config, modeConfig) => {
    // This is a regular expression used in multiple contexts.
    const MULTICHAR_ESCAPE_REGEX =
        '\\\\NUL|\\\\SOH|\\\\STX|\\\\ETX|\\\\EOT|\\\\ENQ|\\\\ACK|\\\\BEL|\\\\BS|' +
        '\\\\HT|\\\\LF|\\\\VT|\\\\FF|\\\\CR|\\\\SO|\\\\SI|\\\\DLE|\\\\DC1|\\\\DC2|' +
        '\\\\DC3|\\\\DC4|\\\\NAK|\\\\SYN|\\\\ETB|\\\\CAN|\\\\EM|\\\\SUB|\\\\ESC|' +
        '\\\\FS|\\\\GS|\\\\RS|\\\\US|\\\\SP|\\\\DEL';

    const RE_WHITESPACE = /[ \v\t\f]+/;
    const RE_STARTMETA = /{-#/;
    const RE_STARTCOMMENT = /{-/;
    const RE_DASHES = /--+(?=$|[^:!#$%&*+.\/<=>?@\\^|~-]+)/;
    const RE_QUAL =
        /[A-Z][A-Za-z_0-9']*\.(?=[A-Za-z_:!#$%&*+.\/<=>?@\\^|~]|-[^-])/;
    const RE_VARID = /[a-z_][A-Za-z_0-9']*/;
    const RE_CONID = /[A-Z][A-Za-z_0-9']*/;
    const RE_VARSYM = /[!#$%&*+.\/<=>?@\\^|~-][:!#$%&*+.\/<=>?@\\^|~-]*/;
    const RE_CONSYM = /:[:!#$%&*+.\/<=>?@\\^|~-]*/;
    const RE_NUMBER =
        /[0-9]+(?:\.[0-9]+)?(?:[eE][+-]?[0-9]+)?|0[oO][0-7]+|0[xX][0-9a-fA-F]+/;
    const RE_CHAR = new RegExp(
        `'(?:[^\\\\']|\\\\[abfnrtv\\\\"']|\\\\^[A-Z@[\\\\\\]^_]|${ 
            MULTICHAR_ESCAPE_REGEX})'`);
    const RE_STRING = new RegExp(
        `"(?:[^\\\\"]|\\\\[abfnrtv\\\\"'&]|\\\\^[A-Z@[\\\\\\]^_]|${ 
            MULTICHAR_ESCAPE_REGEX})*"`);
    const RE_OPENBRACKET = /[([{]/;
    const RE_CLOSEBRACKET = /[)\]}]/;
    const RE_INCOMMENT = /(?:[^{-]|-(?=$|[^}])|\{(?=$|[^-]))*/;
    const RE_ENDCOMMENT = /-}/;

    function opening(bracket) {
        if (bracket == ')') return '(';
        if (bracket == ']') return '[';
        if (bracket == '}') return '{';
        return bracket;
    }

    // The state has the following properties:
    //
    // func:          The function to tokenize the remaining stream.
    // commentLevel:  Number of levels of block comments.
    // brackets:      Brackets, from outermost to innermost.

    function normal(stream, state) {
        if (stream.match(RE_WHITESPACE)) return null;

        if (stream.match(RE_STARTMETA)) {
            state.func = blockComment('meta');
            ++state.commentLevel;
            return state.func(stream, state);
        }

        if (stream.match(RE_STARTCOMMENT)) {
            state.func = blockComment('comment');
            ++state.commentLevel;
            return state.func(stream, state);
        }

        if (stream.match(RE_DASHES)) {
            stream.skipToEnd();
            return 'comment';
        }

        if (stream.match(RE_QUAL)) return 'qualifier';
        if (stream.match(RE_VARID) || stream.match(RE_VARSYM)) return 'variable';
        if (stream.match(RE_CONID) || stream.match(RE_CONSYM)) return 'variable-2';
        if (stream.match(RE_NUMBER)) return 'number';
        if (stream.match(RE_CHAR) || stream.match(RE_STRING)) return 'string';

        if (stream.match(RE_OPENBRACKET)) {
            state.brackets.push(stream.current());
            return `bracket${state.brackets.length <= 7 ? `-${  
                state.brackets.length - 1}` : ''}`;
        }

        if (stream.match(RE_CLOSEBRACKET)) {
            const i = state.brackets.lastIndexOf(opening(stream.current()));
            if (i < 0) {
                return 'bracket';
            } else {
                while (state.brackets.length > i) state.brackets.pop();
                return `bracket${state.brackets.length <= 6 ? `-${ 
                    state.brackets.length}` : ''}`;
            }
        }

        if (stream.eat(',')) return null;

        stream.next();
        return 'error';
    }

    function blockComment(tokenType) {
        return (stream, state) => {
            if (state.commentLevel == 0) {
                state.func = normal;
                return tokenType;
            }

            stream.match(RE_INCOMMENT);
            if (stream.match(RE_STARTCOMMENT)) {
                ++state.commentLevel;
                return state.func(stream, state);
            }
            if (stream.match(RE_ENDCOMMENT)) {
                --state.commentLevel;
                return state.func(stream, state);
            }
            return tokenType;
        };
    }

    const wellKnownWords = (() => {
        const result = {};

        const keywords = [
            'case', 'class', 'data', 'default', 'deriving',
            'do', 'else', 'foreign',
            'if', 'import', 'in', 'infix', 'infixl',
            'infixr', 'instance', 'let',
            'module', 'newtype', 'of', 'then', 'type',
            'where', '_', '..', ':',
            '=', '::', '\\', '<-', '->', '@', '~', '=>',
            '|'
        ];

        for (let i = 0; i < keywords.length; ++i) {
            result[
                keywords[i]] = 'keyword';
        }

        const override = modeConfig.overrideKeywords;
        if (override) {
            for (const word in override) {
                if (override.hasOwnProperty(word)) {
                    result[word] = override[word];
                }
            }
        }

        return result;
    })();

    return {
        startState: () => {
            return {
                func: normal,
                commentLevel: 0,
                brackets: []
            };
        },

        token: (stream, state) => {
            const t = state.func(stream, state);
            if (['variable', 'variable-2'].indexOf(t) != -1) {
                const w = stream.current();
                if (wellKnownWords.hasOwnProperty(w)) return wellKnownWords[w];
            }
            return t;
        },

        blockCommentStart: '{-',
        blockCommentEnd: '-}',
        lineComment: '--',
        indent: null
    };
});
