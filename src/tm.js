/**
 * @template T 
 * @typedef {{[key in string]?: T}} Dict
 */

/**
 * @typedef  {object}          JSON_Grammar
 * @property {string}          scopeName
 * @property {JSON_Pattern[]}  patterns
 * @property {JSON_Repository} repository
 */

/**
 * @typedef {Dict<JSON_Pattern>} JSON_Repository
 */

/**
 * @typedef  {object}         JSON_Pattern
 * @property {string}         [include]
 * @property {string}         [name]
 * @property {string}         [match]
 * @property {string}         [begin]
 * @property {string}         [end]
 * @property {Captures}       [captures]
 * @property {Captures}       [beginCaptures]
 * @property {Captures}       [endCaptures]
 * @property {JSON_Pattern[]} [patterns]
 */

/** 
 * @typedef {Dict<Capture>} Captures
 */

/**
 * @typedef  {object} Capture
 * @property {string} name
 */

/**
 * @param   {unknown | JSON_Grammar} grammar 
 * @returns {grammar is JSON_Grammar} */
export function validate_json_grammar(grammar) {
	return (
		grammar !== null &&
		typeof grammar === "object" &&
		"name"       in grammar && typeof grammar.name === "string" &&
		"scopeName"  in grammar && typeof grammar.scopeName === "string" &&
		"patterns"   in grammar && Array.isArray(grammar.patterns) && grammar.patterns.every(validate_json_pattern) &&
		"repository" in grammar && typeof grammar.repository === "object" && grammar.repository !== null && Object.values(grammar.repository).every(validate_json_pattern)
	)
}

/**
 * @param   {unknown | JSON_Pattern}  pattern 
 * @returns {pattern is JSON_Pattern} */
export function validate_json_pattern(pattern) {
	return (
		pattern !== null &&
		typeof pattern === "object" &&
		(!("include"       in pattern) || typeof pattern.include === "string") &&
		(!("match"         in pattern) || typeof pattern.match === "string") &&
		(!("begin"         in pattern) || typeof pattern.begin === "string") &&
		(!("end"           in pattern) || typeof pattern.end === "string") &&
		(!("captures"      in pattern) || validate_captures(pattern.captures)) &&
		(!("beginCaptures" in pattern) || validate_captures(pattern.beginCaptures)) &&
		(!("endCaptures"   in pattern) || validate_captures(pattern.endCaptures)) &&
		(!("patterns"      in pattern) || Array.isArray(pattern.patterns) && pattern.patterns.every(validate_json_pattern))
	)
}

/**
 * @param   {unknown | Captures}   captures 
 * @returns {captures is Captures} */
export function validate_captures(captures) {
	return (
		captures !== null &&
		typeof captures === "object" &&
		Object.values(captures).every(validate_capture)
	)
}

/**
 * @param {unknown | Capture} capture 
 * @returns {capture is Capture}
 */
export function validate_capture(capture) {
	return (
		capture !== null &&
		typeof capture === "object" &&
		"name" in capture && typeof capture.name === "string"
	)
}

/**
 * @typedef  {object}    Grammar
 * @property {string}    scope
 * @property {Pattern[]} patterns
 */

/**
 * @typedef {Dict<Pattern>} Repository
 */

/**
 * @typedef  {object}    Pattern
 * @property {string?}   name
 * @property {RegExp?}   begin_match
 * @property {Captures?} begin_captures
 * @property {RegExp?}   end_match
 * @property {Captures?} end_captures
 * @property {Pattern[]} patterns
 */

/**
 * @param   {JSON_Grammar} json
 * @returns {Grammar}      */
export function json_to_grammar(json)
{
	/** @type {Repository} */ let repo = {}

	/** @type {Grammar} */ let grammar = {
		scope   : json.scopeName,
		patterns: [],
	}
	
	for (const json_pattern of json.patterns) {
		grammar.patterns.push(json_to_pattern(json_pattern, json.repository, repo))
	}

	return grammar
}

/**
 * @param   {JSON_Pattern}    json
 * @param   {JSON_Repository} repo_json
 * @param   {Repository}      repo
 * @returns {Pattern}        */
function json_to_pattern(json, repo_json, repo)
{
	switch (true) {
	case json.match !== undefined:
	{
		/** @type {Pattern} */ let pattern = {
			name          : json.name || null,
			begin_match   : new RegExp(json.match, "yd"),
			begin_captures: json.captures || null,
			end_match     : null,
			end_captures  : null,
			patterns      : [],
		}
		return pattern
	}
	case json.begin !== undefined && json.end !== undefined:
	{
		/** @type {Pattern} */ let pattern = {
			name          : json.name || null,
			begin_match   : new RegExp(json.begin, "yd"),
			begin_captures: json.beginCaptures || null,
			end_match     : new RegExp(json.end,   "yd"),
			end_captures  : json.endCaptures   || null,
			patterns      : [],
		}
		if (json.patterns !== undefined) {
			for (const sub_json of json.patterns) {
				pattern.patterns.push(json_to_pattern(sub_json, repo_json, repo))
			}
		}
		return pattern
	}
	case json.include !== undefined:
	{
		let patterns = repo[json.include]
		if (patterns !== undefined) {
			return patterns
		}

		/** @type {Pattern} */ let pattern = {
			name          : null,
			begin_match   : null,
			begin_captures: null,
			end_match     : null,
			end_captures  : null,
			patterns      : [],
		}

		if (json.include[0] !== "#") {
			return pattern
		}

		let patterns_json = repo_json[json.include.slice(1)]
		if (patterns_json === undefined) {
			return pattern
		}

		repo[json.include] = pattern
		let actual = json_to_pattern(patterns_json, repo_json, repo)
		pattern.name           = actual.name
		pattern.begin_match    = actual.begin_match
		pattern.begin_captures = actual.begin_captures
		pattern.end_match      = actual.end_match
		pattern.end_captures   = actual.end_captures
		pattern.patterns       = actual.patterns

		return pattern
	}
	case json.patterns !== undefined:
	{
		/** @type {Pattern[]} */ let patterns = []
		for (const sub_json of json.patterns) {
			patterns.push(json_to_pattern(sub_json, repo_json, repo))
		}
		return {
			name          : json.name || null,
			begin_match   : null,
			begin_captures: null,
			end_match     : null,
			end_captures  : null,
			patterns      : patterns,
		}
	}
	}

	return {
		name          : null,
		begin_match   : null,
		begin_captures: null,
		end_match     : null,
		end_captures  : null,
		patterns      : [],
	}
}

/**
 * @typedef  {object}              Tokenizer
 * @property {string}              code
 * @property {string}              line
 * @property {number}              pos_char
 * @property {number}              pos_line
 * @property {{[_:number]: Token}} tokens // preallocated array
 * @property {number}              len    // len of tokens
 */

/**
 * @typedef  {object}   Token
 * @property {string}   content
 * @property {string[]} scopes
 */

/**
 * @param   {string}  code 
 * @param   {Grammar} grammar
 * @returns {Token[]} */
export function code_to_tokens(code, grammar)
{
	/** @type {Token[]} */ let tokens = new Array(code.length)

	/** @type {Tokenizer} */
	let t = {
		code    : code,
		line    : code,
		pos_char: 0,
		pos_line: 0,
		tokens  : tokens,
		len     : 0,
	}

	/** @type {string[]} */ let source_scopes = [grammar.scope]

	loop: while (t.pos_char < t.code.length)
	{
		for (const pattern of grammar.patterns) {
			if (pattern_to_tokens(t, pattern, source_scopes)) {
				continue loop
			}
		}

		// text between patterns
		let last_token = t.tokens[t.len-1]
		if (last_token.scopes.length !== 1) {
			last_token = {content: "", scopes: source_scopes}
			t.tokens[t.len] = last_token
			t.len += 1
		}
		last_token.content += t.code[t.pos_char]
		
		increment_pos(t)
	}

	return tokens.slice(0, t.len)
}

/**
 * @param {Tokenizer} t
 */
function increment_pos(t)
{
	if (t.code[t.pos_char] === "\n") {
		t.pos_line = t.pos_char + 1
		t.line     = t.code.slice(t.pos_line)
	}

	t.pos_char += 1
}

/**
 * @param   {Tokenizer}       t
 * @param   {RegExpExecArray} result
 * @param   {Captures?}       captures
 * @param   {string[]}        pattern_scopes
 * @returns {void}            */
function match_captures(t, result, captures, pattern_scopes)
{
	if (captures == null)
	{
		/** @type {Token} */ let token = {
			content: result[0],
			scopes : pattern_scopes,
		}
		t.tokens[t.len] = token
		t.len += 1
		return
	}

	if (result.length === 1)
	{
		/** @type {Token} */ let token = {
			content: result[0],
			scopes : pattern_scopes,
		}
		if (captures[0] !== undefined) token.scopes = [...token.scopes, captures[0].name]
		t.tokens[t.len] = token
		t.len += 1
		return
	}

	let last_end = 0
	
	for (let key = 1; key < result.length; key += 1)
	{
		let group   = result[key]
		let indices = /** @type {RegExpIndicesArray} */(result.indices)[key]
		if (indices === undefined) continue
		let [pos, end] = indices

		// text between captures
		if (pos > last_end) {
			/** @type {Token} */ let subtoken = {
				content: t.code.slice(t.pos_char + last_end, t.pos_char + pos),
				scopes : pattern_scopes,
			}
			t.tokens[t.len] = subtoken
			t.len += 1
		}
		last_end = end

		// capture
		/** @type {Token} */ let capture_token = {
			content: group,
			scopes : pattern_scopes,
		}
		let capture = captures[key]
		if (capture !== undefined) capture_token.scopes = [...capture_token.scopes, capture.name]
		t.tokens[t.len] = capture_token
		t.len += 1
	}

	// text after last capture
	if (last_end < result[0].length)
	{
		/** @type {Token} */ let subtoken = {
			content: t.code.slice(t.pos_char + last_end, t.pos_char + result[0].length),
			scopes : pattern_scopes,
		}
		t.tokens[t.len] = subtoken
		t.len += 1
	}
}

/**
 * @param   {Tokenizer} t
 * @param   {Pattern}   pattern
 * @param   {string[]}  parent_scopes
 * @returns {boolean}   success */
function pattern_to_tokens(t, pattern, parent_scopes)
{
	// only patterns
	if (pattern.begin_match === null)
	{
		let pattern_scopes = pattern.name !== null
			? [...parent_scopes, pattern.name]
			: parent_scopes

		for (let subpattern of pattern.patterns) {
			if (pattern_to_tokens(t, subpattern, pattern_scopes)) {
				return true
			}
		}
		return false
	}


	// begin
	pattern.begin_match.lastIndex = t.pos_char - t.pos_line
	let begin_result = pattern.begin_match.exec(t.line)
	if (begin_result === null) {
		return false
	}

	let pattern_scopes = pattern.name !== null
		? [...parent_scopes, pattern.name]
		: parent_scopes

	match_captures(t, begin_result, pattern.begin_captures, pattern_scopes)
	t.pos_char += begin_result[0].length

	// no end
	if (pattern.end_match === null) {
		return true
	}

	loop: while (t.pos_char < t.code.length)
	{
		// end
		pattern.end_match.lastIndex = t.pos_char - t.pos_line
		let end_result = pattern.end_match.exec(t.line)
		if (end_result !== null)
		{
			match_captures(t, end_result, pattern.end_captures, pattern_scopes)
			t.pos_char += end_result[0].length
			break loop
		}

		// patterns
		for (let subpattern of pattern.patterns) {
			if (pattern_to_tokens(t, subpattern, pattern_scopes)) {
				continue loop
			}
		}

		// text between patterns
		let last_token = t.tokens[t.len-1]
		if (last_token.scopes[last_token.scopes.length-1] !== pattern_scopes[pattern_scopes.length-1]) {
			last_token = {content: "", scopes: pattern_scopes}
			t.tokens[t.len] = last_token
			t.len += 1
		}
		last_token.content += t.code[t.pos_char]

		increment_pos(t)
	}

	return true
}
