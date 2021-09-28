export type VSCodeApi = {
  postMessage(message: any): void;
  getState(): any;
  setState(state: any): void;
};

