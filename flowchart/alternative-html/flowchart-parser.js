// flowchart-parser.js — Python → Mermaid (flowchart TD)
// Mantém features do seu modelo (def/return/assign/if/else/loops/prints/chamadas)
// Correções principais:
//  - Escapes robustos para Mermaid (<, >, |, [], {}, aspas, barras)
//  - Shape de return: [/ label /]  (válido)
//  - Loops com ((label)) (sem triple parens)
//  - Deduplicação de arestas
//  - Decisões com “Sim/Não” (apenas na 1ª aresta de cada ramo)
//  - Merge pós-if só quando há código depois do if (evita “Continuar” desnecessário)

(function (global) {
  class PythonFlowchartParser {
    constructor(code, options = {}) {
      this.code = code || "";
      this.options = {
        maxBlocks: options.maxBlocks ?? 30,
        showLoops: options.showLoops ?? true,
        showConditions: options.showConditions ?? true,
        showFunctionCalls: options.showFunctionCalls ?? true,
        showPrints: options.showPrints ?? true,
        locale: options.locale || "ptBR", // "ptBR" | "en"
      };

      this.lines = this.code.split(/\r?\n/);
      this.nodeId = 0;
      this.blockCount = 0;
      this.nodes = [];
      this.edges = [];
    }

    // ───────────────────────── Utils ─────────────────────────
    t(key) {
      const PT = {
        start: "Início",
        end: "Fim",
        yes: "Sim",
        no: "Não",
        returns: (v) => (v ? `Retorna ${v}` : "Retorna"),
        continue: "Continuar",
      };
      const EN = {
        start: "Start",
        end: "End",
        yes: "Yes",
        no: "No",
        returns: (v) => (v ? `Return ${v}` : "Return"),
        continue: "Continue",
      };
      const L = this.options.locale === "ptBR" ? PT : EN;
      return L[key];
    }

    generateId() {
      return `node${this.nodeId++}`;
    }

    escape(text) {
      if (text == null) return '';
      return String(text)
        .replace(/\\/g, '\\\\')     // backslash
        .replace(/"/g, "'")         // double quotes
        .replace(/\[/g, ' ')        // brackets → parens (avoid shape collisions)
        .replace(/\]/g, ' ')
        .replace(/\{/g, ' ')
        .replace(/\}/g, ' ')
        .replace(/\)/g, ' ')
        .replace(/\(/g, '->')
        .replace(/</g, '&lt;')      // HTML
        .replace(/>/g, '&gt;')
        .replace(/\|/g, '&#124;')   // edge label pipe
        .replace(/\s+/g, ' ')       // collapse whitespace
        .trim();
    }

    cleanShapeLabel(text) {
      const s = this.escape(text)
        .replace(/\s+/g, ' ')   // collapse whitespace
        .trim();
      // Strip leading/trailing (), [], {} if user text wrapped the whole label
      const stripped = s
        .replace(/^[\[\]\{\}\(\)]+/, '')
        .replace(/[\[\]\{\}\(\)]+$/, '')
        .trim();
      return stripped;
    }

    clamp(text, n = 60) {
      const s = this.escape(text);
      return s.length > n ? s.slice(0, n - 1) + "…" : s;
    }

    getIndent(line) {
      const m = line.match(/^(\s*)/);
      return m ? m[1].length : 0;
    }

    isBlankOrComment(t) {
      return !t || t.startsWith("#");
    }

    // ───────────────────── Mermaid helpers ───────────────────
    addNode(type, label) {
      if (this.blockCount >= this.options.maxBlocks) return null;
    
      const id = this.generateId();
      let shape;
    
      switch (type) {
        case 'start':
        case 'end': {
          const lbl = this.cleanShapeLabel(label);
          shape = `${id}([${lbl}])`;        // no inner spaces
          break;
        }
        case 'function': {
          const lbl = this.escape(label).trim();
          shape = `${id}[[${lbl}]]`;
          break;
        }
        case 'process': {
          const lbl = this.escape(label).trim();
          shape = `${id}[${lbl}]`;
          break;
        }
        case 'decision': {
          let lbl = this.cleanShapeLabel(label).replace(/\?+$/, '');
          lbl = `${lbl}?`;
          shape = `${id}{${lbl}}`;
          break;
        }
        case 'loop': {
          const lbl = this.cleanShapeLabel(label);
          shape = `${id}((${lbl}))`;        // no spaces → prevents “(((”
          break;
        }
        case 'print': {
          let lbl = this.escape(label).trim();
          shape = `${id}[/ "print ${lbl} " /]`;
          break;
        }
        case 'return': {
          const lbl = this.escape(label).trim();
          shape = `${id}[/ ${lbl} /]`;
          break;
        }
        case 'call': {
          const lbl = this.escape(label).trim();
          shape = `${id}[${lbl}]`;
          break;
        }
        default: {
          const lbl = this.escape(label).trim();
          shape = `${id}[${lbl}]`;
        }
      }
    
      this.nodes.push(`    ${shape}`);
      this.blockCount++;
      return id;
    }

    addEdge(from, to, lbl = "") {
      if (!from || !to) return;
      if (lbl) this.edges.push(`    ${from} -->|${lbl}| ${to}`);
      else this.edges.push(`    ${from} --> ${to}`);
    }

    // ───────────────────────── Parse ─────────────────────────
    parseCode() {
      this.nodes = [];
      this.edges = [];
      this.nodeId = 0;
      this.blockCount = 0;

      const startId = this.addNode("start", this.t("start"));
      let last = startId;

      // Pilhas
      const blockStack = []; // loops, funções etc.  {indent, type, id}
      const ifStack = [];    // decisões             {indent, id, lastTrue, lastFalse, needsTrueEdge, needsFalseEdge, merged}

      // Funções auxiliares
      const nextMeaningfulFrom = (idx) => {
        let j = idx + 1;
        while (j < this.lines.length) {
          const tl = this.lines[j].trim();
          if (!this.isBlankOrComment(tl) && !/^([\"']){3}/.test(tl)) return j;
          j++;
        }
        return -1;
      };

      // pula docstring a partir da linha i (retorna novo i)
      const skipDocstring = (i, trimmed) => {
        const quote = trimmed.slice(0, 3);
        if (trimmed.endsWith(quote) && trimmed.length > 3) return i; // docstring inline """..."""
        i++;
        while (i < this.lines.length && !this.lines[i].includes(quote)) i++;
        return i;
      };

      for (let i = 0; i < this.lines.length; i++) {
        let line = this.lines[i];
        let trimmed = line.trim();

        if (this.isBlankOrComment(trimmed)) continue;

        // Docstring
        if (/^([\"']){3}/.test(trimmed)) {
          i = skipDocstring(i, trimmed);
          continue;
        }

        const curIndent = this.getIndent(line);

        // Dedent: fecha blocks (loops) e ifs conforme necessário
        // Fecha loops
        while (blockStack.length && curIndent < blockStack[blockStack.length - 1].indent) {
          blockStack.pop();
          // não cria merges automáticos para loop
        }

        // Fecha ifs
        while (ifStack.length && curIndent <= ifStack[ifStack.length - 1].indent) {
          const top = ifStack.pop();

          // Decide se precisamos de merge:
          // se houver próxima linha significativa no mesmo nível (ou menos), cria merge;
          // se acabou arquivo ou bloco, não cria (deixa ramos seguirem para o fim).
          const nextIdx = nextMeaningfulFrom(i);
          let mustMerge = false;
          if (nextIdx !== -1) {
            const nextIndent = this.getIndent(this.lines[nextIdx]);
            if (nextIndent <= top.indent) mustMerge = true;
          }

          if (mustMerge) {
            const mergeId = this.addNode("process", this.t("continue"));
            if (top.lastTrue && (!top.merged)) this.addEdge(top.lastTrue, mergeId);
            if (top.lastFalse && (!top.merged)) this.addEdge(top.lastFalse, mergeId);
            last = mergeId;
            top.merged = true;
          } else {
            // sem merge explícito — deixa cada ramo seguir
            // Se só houve ramo True, atualiza last = lastTrue
            if (top.lastFalse && !top.lastTrue) last = top.lastFalse;
            if (top.lastTrue && !top.lastFalse) last = top.lastTrue;
            // se ambos existem, mantém last como está (será atualizado pelo próximo nó)
          }
        }

        // def
        if (/^def\s+\w+\s*\(.*\)\s*:/.test(trimmed)) {
          const m = trimmed.match(/^def\s+(\w+)\s*\((.*?)\)\s*:/);
          if (m) {
            const name = m[1];
            // forma concisa: remover valores default e vírgulas -> espaço
            const params = this.clamp(m[2].replace(/\s*=\s*[^,]+/g, "").replace(/,/g, " ").trim());
            const label = params ? `${name} ${params}` : `${name}`;
            const id = this.addNode("function", label);
            if (id && last) this.addEdge(last, id);
            last = id;
            blockStack.push({ indent: curIndent + 4, type: "function", id }); // corpo do def é 4 espaços a frente
          }
          continue;
        }

        // while
        if (this.options.showLoops && /^while\s+.+:/.test(trimmed)) {
          const cond = this.clamp(trimmed.replace(/^while\s+(.+):$/, "$1"));
          const id = this.addNode("loop", `while ${cond}`);
          if (id && last) this.addEdge(last, id);
          last = id;
          blockStack.push({ indent: curIndent + 4, type: "loop", id });
          continue;
        }

        // for
        if (this.options.showLoops && /^for\s+.+:/.test(trimmed)) {
          const hdr = this.clamp(trimmed.replace(/^for\s+(.+):$/, "$1"));
          const id = this.addNode("loop", `for ${hdr}`);
          if (id && last) this.addEdge(last, id);
          last = id;
          blockStack.push({ indent: curIndent + 4, type: "loop", id });
          continue;
        }

        // if
        if (this.options.showConditions && /^if\s+.+:/.test(trimmed)) {
          const cond = this.clamp(trimmed.replace(/^if\s+(.+):$/, "$1"));
          const id = this.addNode("decision", cond);
          if (id && last) this.addEdge(last, id);
          // marca que precisamos criar a primeira aresta True/False a partir da decisão
          ifStack.push({
            indent: curIndent,
            id,
            lastTrue: null,
            lastFalse: null,
            needsTrueEdge: true,
            needsFalseEdge: true,
            merged: false,
          });
          last = id;
          continue;
        }

        // else
        if (this.options.showConditions && /^else\s*:/.test(trimmed)) {
          // apenas reposiciona para a decisão atual — a próxima instrução será o 1º nó do ramo falso
          const top = ifStack[ifStack.length - 1];
          if (top) last = top.id;
          continue;
        }

        // return
        if (/^return\b/.test(trimmed)) {
          const val = this.clamp(trimmed.replace(/^return\s*/, ""));
          const label = this.t("returns")(val);
          const id = this.addNode("return", label);
          if (id) {
            const top = ifStack[ifStack.length - 1];
            if (top) {
              // 1ª aresta rotulada por ramo, as demais seguem sem rótulo
              if (last === top.id && top.needsTrueEdge) {
                this.addEdge(top.id, id, this.t("yes"));
                top.needsTrueEdge = false;
                top.lastTrue = id;
              } else if (last === top.id && top.needsFalseEdge) {
                this.addEdge(top.id, id, this.t("no"));
                top.needsFalseEdge = false;
                top.lastFalse = id;
              } else {
                this.addEdge(last, id);
                // Atualiza último nó do ramo corrente, se aplicável
                if (top.needsFalseEdge === false && top.needsTrueEdge) top.lastFalse = id;
                if (top.needsTrueEdge === false && top.needsFalseEdge) top.lastTrue = id;
              }
            } else {
              this.addEdge(last, id);
            }
            last = id;
          }
          continue;
        }

        // print(...)
        if (this.options.showPrints && /^print\s*\(.*\)\s*$/.test(trimmed)) {
          const content = this.clamp(trimmed.replace(/^print\s*\((.*)\)\s*$/, "$1"));
          const id = this.addNode("print", content);
          if (id) {
            const top = ifStack[ifStack.length - 1];
            if (top && last === top.id) {
              if (top.needsTrueEdge) {
                this.addEdge(top.id, id, this.t("yes"));
                top.needsTrueEdge = false;
                top.lastTrue = id;
              } else if (top.needsFalseEdge) {
                this.addEdge(top.id, id, this.t("no"));
                top.needsFalseEdge = false;
                top.lastFalse = id;
              } else {
                this.addEdge(last, id);
              }
            } else {
              this.addEdge(last, id);
            }
            last = id;
          }
          continue;
        }

        // x = foo(...)
        if (/^\w+\s*=\s*\w+\s*\(.*\)\s*$/.test(trimmed)) {
          const m = trimmed.match(/^(\w+)\s*=\s*(\w+)\s*\((.*)\)\s*$/);
          if (m) {
            const varName = m[1];
            const fn = m[2];
            const args = this.clamp(m[3]);

            let prev = last;
            const isBuiltin = ["print", "range", "len", "str", "int", "float"].includes(fn);
            if (this.options.showFunctionCalls && !isBuiltin) {
              const callId = this.addNode("call", `${fn}(${args})`);
              if (callId) {
                // 1ª aresta de ramo (se for logo após decisão)
                const top = ifStack[ifStack.length - 1];
                if (top && last === top.id) {
                  if (top.needsTrueEdge) {
                    this.addEdge(top.id, callId, this.t("yes"));
                    top.needsTrueEdge = false;
                    top.lastTrue = callId;
                  } else if (top.needsFalseEdge) {
                    this.addEdge(top.id, callId, this.t("no"));
                    top.needsFalseEdge = false;
                    top.lastFalse = callId;
                  } else {
                    this.addEdge(last, callId);
                  }
                } else {
                  this.addEdge(last, callId);
                }
                prev = callId;
              }
            }

            const assignId = this.addNode("process", `${this.escape(varName)} = result`);
            if (assignId) this.addEdge(prev, assignId);
            // atualiza ramo atual, se existia
            const top = ifStack[ifStack.length - 1];
            if (top) {
              if (!top.needsTrueEdge && top.lastTrue && (last === top.id || prev === top.lastTrue)) {
                top.lastTrue = assignId;
              } else if (!top.needsFalseEdge && top.lastFalse && (last === top.id || prev === top.lastFalse)) {
                top.lastFalse = assignId;
              }
            }
            last = assignId || prev;
          }
          continue;
        }

        // chamada simples foo(...)
        if (this.options.showFunctionCalls && /^\w+\s*\(.*\)\s*$/.test(trimmed)) {
          const m = trimmed.match(/^(\w+)\s*\((.*)\)\s*$/);
          if (m) {
            const fn = m[1];
            if (!["print", "range", "len", "str", "int", "float"].includes(fn)) {
              const args = this.clamp(m[2]);
              const id = this.addNode("call", `${fn}(${args})`);
              if (id) {
                const top = ifStack[ifStack.length - 1];
                if (top && last === top.id) {
                  if (top.needsTrueEdge) {
                    this.addEdge(top.id, id, this.t("yes"));
                    top.needsTrueEdge = false;
                    top.lastTrue = id;
                  } else if (top.needsFalseEdge) {
                    this.addEdge(top.id, id, this.t("no"));
                    top.needsFalseEdge = false;
                    top.lastFalse = id;
                  } else {
                    this.addEdge(last, id);
                  }
                } else {
                  this.addEdge(last, id);
                }
                last = id;
              }
            }
          }
          continue;
        }

        // assignment (inclui +=, -=, etc.)
        if (/^\w+\s*[\+\-\*\/%]?=/.test(trimmed)) {
          const m = trimmed.match(/^(\w+)\s*([\+\-\*\/%]?=)\s*(.*)$/);
          if (m) {
            let label = this.clamp(`${m[1]} ${m[2]} ${m[3]}`, 40);
            const id = this.addNode("process", label);
            if (id) {
              const top = ifStack[ifStack.length - 1];
              if (top && last === top.id) {
                if (top.needsTrueEdge) {
                  this.addEdge(top.id, id, this.t("yes"));
                  top.needsTrueEdge = false;
                  top.lastTrue = id;
                } else if (top.needsFalseEdge) {
                  this.addEdge(top.id, id, this.t("no"));
                  top.needsFalseEdge = false;
                  top.lastFalse = id;
                } else {
                  this.addEdge(last, id);
                  // atualização de ramos
                  if (!top.needsTrueEdge && !top.needsFalseEdge) {
                    if (top.lastFalse && (top.lastFalse === last)) top.lastFalse = id;
                    if (top.lastTrue && (top.lastTrue === last)) top.lastTrue = id;
                  }
                }
              } else {
                this.addEdge(last, id);
              }
              last = id;
            }
          }
          continue;
        }

        // linhas não suportadas: ignore
      }

      // Fecha ifs remanescentes
      while (ifStack.length) {
        const top = ifStack.pop();
        // cria merge só se há algo após — aqui, como acabou o arquivo, não cria merge
        // deixa ramos seguir para o fim
        if (top.lastFalse && !top.lastTrue) last = top.lastFalse;
        if (top.lastTrue && !top.lastFalse) last = top.lastTrue;
      }

      // Fim
      const endId = this.addNode("end", this.t("end"));
      if (last && endId) this.addEdge(last, endId);

      // Monta Mermaid final (dedup das edges)
      const header = "flowchart TD\n";
      const body = this.nodes.join("\n") + "\n" + Array.from(new Set(this.edges)).join("\n");
      return header + body;
    }
  }

  // expõe global
  global.PythonFlowchartParser = PythonFlowchartParser;
})(window);
