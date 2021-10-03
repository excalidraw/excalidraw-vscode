type ExcalidrawType = "application/json" | "image/svg+xml"
type ExcalidrawTheme = "light" | "dark" | "auto"

type ExcalidrawConfig = {
	libraryItems: any,
	documentUri: string,
	viewModeEnabled: boolean
	documentType: ExcalidrawType,
	theme: ExcalidrawTheme
}
