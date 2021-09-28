export interface VSCodeMessage {
	type: string
	payload: any
}
export interface ExportMessage extends VSCodeMessage {
	type: "export"
	payload: {
		type: "png" | "svg"
		destinationUri: string
	}
}

export interface UpdateMessage extends VSCodeMessage {
	type: "update"

}

