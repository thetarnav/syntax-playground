// import * as shiki from 'shiki'
// import getShikiWasm from 'shiki/wasm'
import * as tm from './tm.js'
import * as h  from './html.js'

import {
	THEME_JSON_WEBPATH,
	SAMPLE_WEBPATH_ODIN, SAMPLE_WEBPATH_TS,
	LANG_WEBPATH_ODIN, LANG_WEBPATH_TS,
} from './constants.js'

const root =              /** @type {HTMLElement} */ (document.getElementById('root'))
const loading_indicator = /** @type {HTMLElement} */ (document.getElementById('loading_indicator'))

const hash = location.hash.slice(1) || 'odin'
const CODE_WEBPATH = hash === 'ts' ? SAMPLE_WEBPATH_TS : SAMPLE_WEBPATH_ODIN
const LANG_WEBPATH = hash === 'ts' ? LANG_WEBPATH_TS   : LANG_WEBPATH_ODIN

let code_promise  = fetchCode()
let theme_promise = fetchTheme()
let lang_promise  = fetchLang()

/** @returns {Promise<string>} */
function fetchCode() {
	return fetch(CODE_WEBPATH).then(res => res.text())
}
/** @returns {Promise<any>} */
function fetchTheme() {
	return fetch(THEME_JSON_WEBPATH).then(res => res.json())
}
/** @returns {Promise<any>} */
async function fetchLang() {
	return fetch(LANG_WEBPATH).then(res => res.json())
}

/**
@param   {tm.Scope} scope
@param   {string}   src
@returns {HTMLElement} */
function render_scope(scope, src) {

	/** @type {HTMLElement} */ let header
	/** @type {HTMLElement} */ let children

	let scope_name = scope.name
	if (scope_name.endsWith('.odin')) {
		scope_name = scope_name.slice(0, -5)
	}

    let container = h.div({class: 'scope-container'}, [
		header = h.div({class: 'scope-header'},
			`${scope_name} (${scope.pos}-${scope.end})`,
		),
		children = h.div({class: 'scope-children'})
	])

	render_tooltip(header, src.slice(scope.pos, scope.end))

	for (let child of scope.children) {
		children.appendChild(render_scope(child, src))
	}

    return container
}

/**
@param   {tm.Scope} scope
@param   {string}   src
@returns {void}   */
function render_tree(scope, src) {
	root.appendChild(
		h.div({class: 'tree-container'},
			render_scope(scope, src),
		)
	)
}

/**
@param   {tm.Token[]}      tokens
@param   {tm.Theme_Item[]} theme_items
@param   {string}          src
@returns {void}            */
function render_tokens(tokens, theme_items, src) {

	/** @type {HTMLElement[]} */
	let elements = new Array(tokens.length)
	/** @type {tm.Scope_Theme_Settings_Cache} */
	let settings_cache = new Map()

	for (let i = 0; i < tokens.length; i += 1) {
		let token = tokens[i]
		let settings = tm.match_token_theme(token, theme_items, settings_cache)

		let el = elements[i] = h.span({class: 'token'}, src.slice(token.pos, token.end))

		if (settings.foreground) el.style.color           = settings.foreground
		if (settings.background) el.style.backgroundColor = settings.background
		if (settings.fontStyle) {
			if (settings.fontStyle === 'italic')    el.style.fontStyle      = 'italic'
			if (settings.fontStyle === 'bold')      el.style.fontWeight     = 'bold'
			if (settings.fontStyle === 'underline') el.style.textDecoration = 'underline'
		}

		/*
		Skip first because it's always the root scope
		*/
		let scopes_str = ''
		for (let i = 1; i < token.scopes.length; i += 1) {
			let scope = token.scopes[i]
			if (scope.endsWith('.odin')) {
				scope = scope.slice(0, -5)
			}
			scopes_str += scope + '\n'
		}

		render_tooltip(el, scopes_str)
	}

	root.appendChild(h.div({class: 'shiki'}, elements))
}

const tooltip_el = root.appendChild(h.div({class: 'scope-tooltip'}))
tooltip_el.style.visibility = 'hidden'

let tooltip_scope_el = /** @type {HTMLElement?} */(null)
let tooltip_text = ''

/**
 * @param {HTMLElement} el
 * @param {string}      text
 */
function render_tooltip(el, text) {

	el.addEventListener('mousemove', e => {

		if (!tooltip_scope_el) {
			tooltip_el.style.visibility = 'visible'
			tooltip_el.style.willChange = 'transform'
		}

		if (tooltip_text !== text) {
			tooltip_el.textContent = text
			tooltip_text = text
		}
		
		tooltip_scope_el = el
		tooltip_el.style.transform = `translate(${e.clientX}px, ${e.clientY}px)`
		tooltip_el.style.maxWidth  = `${window.innerWidth - e.clientX}px`
	})

	el.addEventListener('mouseleave', () => {
		if (tooltip_scope_el === el) {
			tooltip_el.style.visibility = 'hidden'
			tooltip_el.textContent      = ''
			tooltip_el.style.willChange = ''
			tooltip_scope_el            = null
			tooltip_text                = ''
		}
	})
}

async function main() {
	loading_indicator.style.display = 'block'

	const [code, theme, lang] = await Promise.all([
		code_promise,
		theme_promise,
		lang_promise,
	])

	if (!tm.validate_json_grammar(lang)) {
		console.error('Invalid grammar')
		return
	}

	let grammar = tm.json_to_grammar(lang)
	
	let theme_items = tm.json_to_theme_items(theme.tokenColors || [], grammar.scope)
	let tokens      = tm.code_to_tokens(code, grammar)
	render_tokens(tokens, theme_items, code)

	await new Promise(r => setTimeout(r))

	let tree = tm.parse_code(code, grammar)
	render_tree(tree, code)

	// const highlighter_promise = shiki.getHighlighterCore({
	// 	themes:   [theme_promise],
	// 	langs:    [lang_promise],
	// 	loadWasm: getShikiWasm,
	// })

	// const [code, theme, lang, highlighter] = await Promise.all([
	// 	code_promise,
	// 	theme_promise,
	// 	lang_promise,
	// 	highlighter_promise,
	// ])

	// const tokens_lines = highlighter.codeToTokens(code, { // this is slow...
	// 	lang: lang.name,
	// 	theme: /** @type {string} */ (theme.name),
	// 	includeExplanation: true,
	// })

	// /** @type {HTMLElement[]} */
	// const elements_lines = new Array(tokens_lines.tokens.length)
	// /** @type {Map<HTMLElement, string>} */
	// const scopes_map = new Map()

	// for (let i = 0; i < tokens_lines.tokens.length; i += 1) {
	// 	const tokens = tokens_lines.tokens[i]
	// 	/** @type {HTMLElement[]} */
	// 	const elements = new Array(tokens.length)

	// 	for (let j = 0; j < tokens.length; j += 1) {
	// 		const token = tokens[j]
	// 		if (!token.explanation) continue

	// 		const token_el = document.createElement('span')
	// 		token_el.className = 'token'
	// 		elements[j] = token_el

	// 		for (const explanation of token.explanation) {
	// 			const scope_el = document.createElement('span')
	// 			scope_el.className = 'scope'
	// 			token_el.append(scope_el)

	// 			scope_el.style.color = token.color || ''
	// 			scope_el.textContent = explanation.content

	// 			if (token.fontStyle) {
	// 				if (token.fontStyle & shiki.FontStyle.Italic) {
	// 					scope_el.style.fontStyle = 'italic'
	// 				}
	// 				if (token.fontStyle & shiki.FontStyle.Bold) {
	// 					scope_el.style.fontWeight = 'bold'
	// 				}
	// 				if (token.fontStyle & shiki.FontStyle.Underline) {
	// 					scope_el.style.textDecoration = 'underline'
	// 				}
	// 			}

	// 			/*
	// 			Skip first because it's always the root scope
	// 			*/
	// 			let scope = ''
	// 			for (let i = 1; i < explanation.scopes.length; i += 1) {
	// 				let name = explanation.scopes[i].scopeName
	// 				if (name.endsWith('.odin')) {
	// 					name = name.slice(0, -5)
	// 				}
	// 				scope += name + '\n'
	// 			}

	// 			scopes_map.set(scope_el, scope)
	// 		}
	// 	}

	// 	const line = document.createElement('div')
	// 	line.className = 'line'
	// 	elements_lines[i] = line
	// 	line.append(...elements)
	// }

	// const shiki_el = document.createElement('div')
	// shiki_el.className = 'shiki'
	// shiki_el.append(...elements_lines)
	// root.innerHTML = ''
	// root.append(shiki_el)

	// /*
	// Show hovered token scope
	// */
	// const tooltip_el = document.createElement('div')
	// tooltip_el.className = 'scope-tooltip'
	// root.append(tooltip_el)

	// /** @type {HTMLElement | null} */
	// let last_scope_el = null
	// shiki_el.addEventListener('mousemove', e => {
	// 	const target = e.target
	// 	if (!(target instanceof HTMLElement)) {
	// 		tooltip_el.style.visibility = 'hidden'
	// 		last_scope_el = null
	// 		return
	// 	}

	// 	if (target !== last_scope_el) {
	// 		const scope = scopes_map.get(target)
	// 		if (!scope) {
	// 			tooltip_el.style.visibility = 'hidden'
	// 			last_scope_el = null
	// 			return
	// 		}

	// 		last_scope_el = target
	// 		tooltip_el.textContent = scope
	// 		tooltip_el.style.visibility = 'visible'
	// 	}

	// 	tooltip_el.style.transform = `translate(${e.clientX}px, ${e.clientY}px)`
	// })

	// shiki_el.addEventListener('mouseleave', () => {
	// 	tooltip_el.style.visibility = 'hidden'
	// 	last_scope_el = null
	// })

	loading_indicator.style.display = 'none'
}

main()
