export function log(api: any, text: any) {
	api.postMessage({type: "log", text})
}

export function info(api: any, text: any) {
	api.postMessage({type: "info", text})
}

export function error(api: any, text: any) {
	api.postMessage({type: "error", text})
}
