class InputStream {
  constructor(text, indentationState, logging) {
    this.line = 1;
    this.column = 1;
    this.text = text;
    this.peeked = [];
    this.done = false;
    this.error = null;
    this.iterator = text[Symbol.iterator]();
    this.indentationState = indentationState;
    this.context = [];
    this.logging = logging;
  }

  reveal(amount) {
    if (this.done || this.error) return;

    for (let i = 0; i < amount; i++) {
      const result = this.iterator.next();

      if (result.done) {
        this.done = true;
      } else {
        this.peeked.push(result.value);
      }
    }
  }

  peek(amount) {
    this.reveal(amount - this.peeked.length);
    return this.peeked.slice(0, amount);
  }

  next(amount) {
    this.reveal(amount - this.peeked.length);

    const result = this.peeked.splice(0, amount);
    for (const char of result) {
      if (char === "\n") {
        this.line += 1;
        this.column = 1;
      } else {
        this.column += 1;
      }
    }

    return result;
  }
}

export const deferImpl = (f) => (stream) => {
  if (!stream.error) {
    return f()(stream);
  }
};
export const pureImpl = (a) => (_) => a;
export const bindImpl = (pa) => (f) => (stream) => {
  if (!stream.error) {
    const first = pa(stream);
    if (!stream.error) {
      return f(first)(stream);
    }
  }
};
export const mapImpl = (f) => (pa) => (stream) => {
  if (!stream.error) {
    const first = pa(stream);
    if (!stream.error) {
      return f(first);
    }
  }
};

export const peekMany = (amount) => (stream) => stream.peek(amount);
export const nextMany = (amount) => (stream) => stream.next(amount);
export const getLine = (stream) => stream.line;
export const getColumn = (stream) => stream.column;
export const getState = (stream) => stream.indentationState;
export const setState = (state) => (stream) => {
  stream.indentationState = state;
};
export const fail = (error) => (stream) => {
  stream.error = error;
};

export const labelImpl = (text) => (f) => (stream) => {
  if (!stream.error) {
    localLog(text, false)(stream);
    stream.context.push(text);
    const result = f(stream);
    if (!stream.error) {
      stream.context.pop();
      return result;
    }
  }
};

export const localLog =
  (text, deco = true) =>
  (stream) => {
    if (!stream.logging || stream.error) return;

    let leading = "  ".repeat(stream.context.length);

    const final = text
      .split("\n")
      .map((line, i) => {
        const decoString = deco ? (i === 0 ? "| " : "  ") : "";
        return `${leading}${decoString}${line}`;
      })
      .join("\n");

    console.log(final);
  };

export const runParserImpl =
  (tuple) =>
  (onSuccess) =>
  (onFailure) =>
  (logging) =>
  (state) =>
  (text) =>
  (f) => {
    const stream = new InputStream(text, state, logging);
    const result = f(stream);
    if (stream.error) {
      return onFailure({
        message: stream.error,
        location: tuple(stream.line)(stream.column),
        context: stream.context,
      });
    } else {
      return onSuccess(result);
    }
  };
