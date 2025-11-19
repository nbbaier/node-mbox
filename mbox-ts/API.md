## Overview

This module exports a single class, Mbox, which extends Node.js’s stream.PassThrough. It parses mbox-formatted input and emits individual messages. It can operate in two modes:

-  Buffered mode (default): buffers message bytes and emits each message as a Buffer or string.
-  Streaming mode (opts.stream === true): emits a PassThrough stream per message as messages are encountered.

## Public API

### Class: Mbox

-  Extends: stream.PassThrough

Construct an instance that reads an mbox source and emits messages.

#### Constructor

-  new Mbox(source?, opts?)

-  source:

   -  A readable stream: treated as the input source directly.
   -  A string or Buffer:
      -  If it resolves to an existing filesystem path (fs.existsSync), a readable file stream is created from that path.
      -  Otherwise, treated as raw data content and converted to a stream (via string-to-stream).
   -  Omitted or any other type: no immediate source is attached; the instance expects to be piped into later.

-  opts (optional object):
   -  stream: boolean
      -  false (default): buffered mode; each message is emitted as bytes (Buffer or string).
      -  true: streaming mode; each message is emitted as a PassThrough stream.
   -  encoding: string (e.g., 'utf8')
      -  Only applies in buffered mode. If set, each emitted message is converted to a string using this encoding; otherwise, a Buffer is emitted.
   -  strict: boolean
      -  If true and the first line does not begin with the mbox postmark "From ", the instance emits an error with code/message 'NOT_AN_MBOX_FILE' and stops processing.

Behavior on construction:

-  If a source stream (or stream derived from path/content) is provided, it is piped into the Mbox instance immediately.
-  If not, the instance listens for pipe events to receive a source later.

#### Events

-  'message'
-  Buffered mode (default): emitted with a single argument containing the full message as:
   -  Buffer (default), or
   -  string (if opts.encoding is set).
-  Streaming mode (opts.stream === true): emitted with a single argument, a PassThrough stream representing the message’s content. The stream ends when the next message starts or input ends.

-  'error'
-  Emitted with Error('NOT_AN_MBOX_FILE') if strict mode is enabled and the first line does not start with the mbox postmark "From ".

-  Standard stream events (inherited from PassThrough/Readable), e.g., 'end', 'data' (though you typically consume via 'message').

#### Properties

-  messageCount: number
-  In buffered mode, increments each time a complete message is emitted.
-  In streaming mode, not incremented in this implementation (only managed in the buffered path).

## Parsing Rules and Behavior

-  Line splitting:
-  Input is split by newline characters using line-stream (split('\n')). Each chunk processed is a "line" including the newline behavior of the splitter.

-  Message boundaries:
-  A line starting with the 5-byte postmark "From " (ASCII) indicates the start of a new message.
-  In buffered mode:
   -  On encountering a postmark line, the previous message (if any) is emitted, then accumulation starts for the next message.
   -  Remaining lines accumulate until the next postmark or end-of-stream, at which point any final message is emitted.
-  In streaming mode:

   -  On encountering a postmark, any existing message stream is ended, a new PassThrough is created and emitted as 'message'.
   -  Each subsequent line is written to the current message stream until the next postmark or end-of-stream, where the current message stream is ended.

-  First-line validation:
-  If the very first line does not start with "From " and opts.strict === true:
   -  Emits 'error' with Error('NOT_AN_MBOX_FILE'), ends the outer stream, and closes any active message stream.
-  If opts.strict is not true, processing ends quietly without emitting an error.

-  Stream lifecycle:
-  On underlying input 'end', any pending buffered message is emitted (buffered mode), and any active message stream is ended (streaming mode).
-  On Mbox instance 'end', any active message stream is also ended.

## Usage Patterns

-  Provide a filename:
-  new Mbox('/path/to/file.mbox', { encoding: 'utf8' })
-  Provide raw content:
-  new Mbox(rawMboxBufferOrString)
-  Provide an existing stream:
-  new Mbox(fs.createReadStream('file.mbox'), { stream: true })
-  Pipe in later:
-  const m = new Mbox({ stream: true })
-  fs.createReadStream('file.mbox').pipe(m)

## Notes and Edge Cases

-  In streaming mode, messageCount is not incremented; consumers should count 'message' events if they need a tally.
-  The parser uses a simple "From " prefix check (first 5 bytes). It does not escape/unescape "From " lines inside message bodies per mbox format variants; it treats any line that begins with "From " as a boundary.
-  Encoding option only affects buffered emissions; streamed messages are raw binary streams.
