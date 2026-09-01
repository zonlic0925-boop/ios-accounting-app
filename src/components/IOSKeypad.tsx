import React, { useCallback, useEffect } from "react";
import { Delete, Check } from "lucide-react";
import { haptics } from "../lib/haptics";

interface KeypadProps {
  expression: string;
  onExpressionChange: (expr: string) => void;
  onConfirm: () => void;
  confirmLabel?: string;
  className?: string;
  showOperators?: boolean;
}

export const IOSKeypad: React.FC<KeypadProps> = ({
  expression,
  onExpressionChange,
  onConfirm,
  confirmLabel = "完成",
  className = "",
  showOperators = true,
}) => {
  // Safe evaluation of mathematical expression
  const evaluateExpression = useCallback((expr: string): string => {
    if (!expr) return "0";
    try {
      // Replace display symbols with JS math operators
      let sanitized = expr
        .replace(/×/g, "*")
        .replace(/÷/g, "/")
        .replace(/−/g, "-")
        .replace(/\+/g, "+");

      // Strip trailing operators
      while (/[+\-*/.]$/.test(sanitized)) {
        sanitized = sanitized.slice(0, -1);
      }

      if (!sanitized) return "0";

      // Evaluate safely with strict numeric operations only
      // Only allow 0-9, +, -, *, /, ., and spaces
      if (!/^[\d+\-*/.\s]+$/.test(sanitized)) {
        return "0";
      }

      // eslint-disable-next-line no-new-func
      const result = new Function(`return (${sanitized})`)();
      if (typeof result === "number" && !isNaN(result) && isFinite(result)) {
        // Round to max 2 decimal places if necessary
        const rounded = Math.round(result * 100) / 100;
        return rounded.toString();
      }
      return "0";
    } catch {
      return "0";
    }
  }, []);

  const hasOperator = /[+\-×÷]/.test(expression);

  const handleKeyPress = (key: string) => {
    haptics.selection();

    // Digits
    if (/^[0-9]$/.test(key)) {
      if (expression === "0" || expression === "") {
        onExpressionChange(key);
      } else {
        // Check decimal length in current token
        const tokens = expression.split(/[+\-×÷]/);
        const lastToken = tokens[tokens.length - 1];
        if (lastToken.includes(".") && lastToken.split(".")[1].length >= 2) {
          // Limit to 2 decimal places per operand
          return;
        }
        onExpressionChange(expression + key);
      }
      return;
    }

    // Dot
    if (key === ".") {
      const tokens = expression.split(/[+\-×÷]/);
      const lastToken = tokens[tokens.length - 1];
      if (!lastToken.includes(".")) {
        onExpressionChange(expression === "" ? "0." : expression + ".");
      }
      return;
    }

    // Operators: +, −, ×, ÷
    if (["+", "−", "×", "÷"].includes(key)) {
      haptics.medium();
      if (!expression || expression === "0") return;

      const lastChar = expression.slice(-1);
      if (["+", "−", "×", "÷"].includes(lastChar)) {
        // Replace previous operator
        onExpressionChange(expression.slice(0, -1) + key);
      } else {
        // If already has another operator, evaluate first!
        if (hasOperator) {
          const evalRes = evaluateExpression(expression);
          onExpressionChange(evalRes + key);
        } else {
          onExpressionChange(expression + key);
        }
      }
      return;
    }

    // Clear
    if (key === "C") {
      haptics.light();
      onExpressionChange("");
      return;
    }

    // Backspace / Delete
    if (key === "backspace") {
      haptics.light();
      if (expression.length > 1) {
        onExpressionChange(expression.slice(0, -1));
      } else {
        onExpressionChange("");
      }
      return;
    }

    // Equals (=)
    if (key === "=") {
      haptics.heavy();
      const res = evaluateExpression(expression);
      onExpressionChange(res);
      return;
    }
  };

  const handleConfirmClick = () => {
    // If expression still has active pending math, calculate first
    if (hasOperator) {
      haptics.heavy();
      const res = evaluateExpression(expression);
      onExpressionChange(res);
      return;
    }
    haptics.success();
    onConfirm();
  };

  // Keyboard shortcut listener for desktop users
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't intercept if typing in a text input or textarea
      if (
        document.activeElement?.tagName === "INPUT" ||
        document.activeElement?.tagName === "TEXTAREA"
      ) {
        return;
      }

      if (e.key >= "0" && e.key <= "9") {
        handleKeyPress(e.key);
      } else if (e.key === ".") {
        handleKeyPress(".");
      } else if (e.key === "+") {
        handleKeyPress("+");
      } else if (e.key === "-") {
        handleKeyPress("−");
      } else if (e.key === "*") {
        handleKeyPress("×");
      } else if (e.key === "/") {
        handleKeyPress("÷");
      } else if (e.key === "Backspace") {
        handleKeyPress("backspace");
      } else if (e.key === "Enter" || e.key === "=") {
        if (hasOperator) {
          handleKeyPress("=");
        } else {
          handleConfirmClick();
        }
      } else if (e.key === "Escape" || e.key === "c" || e.key === "C") {
        handleKeyPress("C");
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [expression, hasOperator, evaluateExpression, onConfirm]);

  return (
    <div className={`grid grid-cols-4 gap-2 select-none ${className}`}>
      {/* Row 1 */}
      <button
        type="button"
        onClick={() => handleKeyPress("7")}
        className="h-12 sm:h-13 rounded-2xl bg-white dark:bg-[#2C2C2E] shadow-sm text-lg sm:text-xl font-semibold text-black dark:text-white ios-tap-active flex items-center justify-center border border-black/[0.04] dark:border-white/[0.06] active:bg-black/5 dark:active:bg-white/10 transition-colors cursor-pointer"
      >
        7
      </button>
      <button
        type="button"
        onClick={() => handleKeyPress("8")}
        className="h-12 sm:h-13 rounded-2xl bg-white dark:bg-[#2C2C2E] shadow-sm text-lg sm:text-xl font-semibold text-black dark:text-white ios-tap-active flex items-center justify-center border border-black/[0.04] dark:border-white/[0.06] active:bg-black/5 dark:active:bg-white/10 transition-colors cursor-pointer"
      >
        8
      </button>
      <button
        type="button"
        onClick={() => handleKeyPress("9")}
        className="h-12 sm:h-13 rounded-2xl bg-white dark:bg-[#2C2C2E] shadow-sm text-lg sm:text-xl font-semibold text-black dark:text-white ios-tap-active flex items-center justify-center border border-black/[0.04] dark:border-white/[0.06] active:bg-black/5 dark:active:bg-white/10 transition-colors cursor-pointer"
      >
        9
      </button>
      {showOperators ? (
        <button
          type="button"
          onClick={() => handleKeyPress("÷")}
          className="h-12 sm:h-13 rounded-2xl bg-orange-500/10 text-orange-500 dark:bg-orange-500/20 dark:text-orange-400 font-bold text-xl ios-tap-active flex items-center justify-center border border-orange-500/20 active:bg-orange-500/30 transition-colors cursor-pointer"
        >
          ÷
        </button>
      ) : (
        <button
          type="button"
          onClick={() => handleKeyPress("C")}
          className="h-12 sm:h-13 rounded-2xl bg-ios-gray-5 dark:bg-ios-gray-dark4 text-ios-gray-1 dark:text-ios-gray-2 font-semibold text-base ios-tap-active flex items-center justify-center transition-colors cursor-pointer"
        >
          C
        </button>
      )}

      {/* Row 2 */}
      <button
        type="button"
        onClick={() => handleKeyPress("4")}
        className="h-12 sm:h-13 rounded-2xl bg-white dark:bg-[#2C2C2E] shadow-sm text-lg sm:text-xl font-semibold text-black dark:text-white ios-tap-active flex items-center justify-center border border-black/[0.04] dark:border-white/[0.06] active:bg-black/5 dark:active:bg-white/10 transition-colors cursor-pointer"
      >
        4
      </button>
      <button
        type="button"
        onClick={() => handleKeyPress("5")}
        className="h-12 sm:h-13 rounded-2xl bg-white dark:bg-[#2C2C2E] shadow-sm text-lg sm:text-xl font-semibold text-black dark:text-white ios-tap-active flex items-center justify-center border border-black/[0.04] dark:border-white/[0.06] active:bg-black/5 dark:active:bg-white/10 transition-colors cursor-pointer"
      >
        5
      </button>
      <button
        type="button"
        onClick={() => handleKeyPress("6")}
        className="h-12 sm:h-13 rounded-2xl bg-white dark:bg-[#2C2C2E] shadow-sm text-lg sm:text-xl font-semibold text-black dark:text-white ios-tap-active flex items-center justify-center border border-black/[0.04] dark:border-white/[0.06] active:bg-black/5 dark:active:bg-white/10 transition-colors cursor-pointer"
      >
        6
      </button>
      {showOperators ? (
        <button
          type="button"
          onClick={() => handleKeyPress("×")}
          className="h-12 sm:h-13 rounded-2xl bg-orange-500/10 text-orange-500 dark:bg-orange-500/20 dark:text-orange-400 font-bold text-xl ios-tap-active flex items-center justify-center border border-orange-500/20 active:bg-orange-500/30 transition-colors cursor-pointer"
        >
          ×
        </button>
      ) : (
        <button
          type="button"
          onClick={() => handleKeyPress("backspace")}
          className="h-12 sm:h-13 rounded-2xl bg-ios-gray-5 dark:bg-ios-gray-dark4 text-black dark:text-white text-base ios-tap-active flex items-center justify-center transition-colors cursor-pointer"
        >
          <Delete className="w-5 h-5" />
        </button>
      )}

      {/* Row 3 */}
      <button
        type="button"
        onClick={() => handleKeyPress("1")}
        className="h-12 sm:h-13 rounded-2xl bg-white dark:bg-[#2C2C2E] shadow-sm text-lg sm:text-xl font-semibold text-black dark:text-white ios-tap-active flex items-center justify-center border border-black/[0.04] dark:border-white/[0.06] active:bg-black/5 dark:active:bg-white/10 transition-colors cursor-pointer"
      >
        1
      </button>
      <button
        type="button"
        onClick={() => handleKeyPress("2")}
        className="h-12 sm:h-13 rounded-2xl bg-white dark:bg-[#2C2C2E] shadow-sm text-lg sm:text-xl font-semibold text-black dark:text-white ios-tap-active flex items-center justify-center border border-black/[0.04] dark:border-white/[0.06] active:bg-black/5 dark:active:bg-white/10 transition-colors cursor-pointer"
      >
        2
      </button>
      <button
        type="button"
        onClick={() => handleKeyPress("3")}
        className="h-12 sm:h-13 rounded-2xl bg-white dark:bg-[#2C2C2E] shadow-sm text-lg sm:text-xl font-semibold text-black dark:text-white ios-tap-active flex items-center justify-center border border-black/[0.04] dark:border-white/[0.06] active:bg-black/5 dark:active:bg-white/10 transition-colors cursor-pointer"
      >
        3
      </button>
      {showOperators ? (
        <button
          type="button"
          onClick={() => handleKeyPress("−")}
          className="h-12 sm:h-13 rounded-2xl bg-orange-500/10 text-orange-500 dark:bg-orange-500/20 dark:text-orange-400 font-bold text-xl ios-tap-active flex items-center justify-center border border-orange-500/20 active:bg-orange-500/30 transition-colors cursor-pointer"
        >
          −
        </button>
      ) : null}

      {/* Row 4 */}
      <button
        type="button"
        onClick={() => handleKeyPress(".")}
        className="h-12 sm:h-13 rounded-2xl bg-white dark:bg-[#2C2C2E] shadow-sm text-xl font-semibold text-black dark:text-white ios-tap-active flex items-center justify-center border border-black/[0.04] dark:border-white/[0.06] active:bg-black/5 dark:active:bg-white/10 transition-colors cursor-pointer"
      >
        .
      </button>
      <button
        type="button"
        onClick={() => handleKeyPress("0")}
        className="h-12 sm:h-13 rounded-2xl bg-white dark:bg-[#2C2C2E] shadow-sm text-lg sm:text-xl font-semibold text-black dark:text-white ios-tap-active flex items-center justify-center border border-black/[0.04] dark:border-white/[0.06] active:bg-black/5 dark:active:bg-white/10 transition-colors cursor-pointer"
      >
        0
      </button>
      <button
        type="button"
        onClick={() => handleKeyPress("backspace")}
        className="h-12 sm:h-13 rounded-2xl bg-white dark:bg-[#2C2C2E] shadow-sm text-black dark:text-white text-base ios-tap-active flex items-center justify-center border border-black/[0.04] dark:border-white/[0.06] active:bg-black/5 dark:active:bg-white/10 transition-colors cursor-pointer"
      >
        <Delete className="w-5 h-5 opacity-80" />
      </button>
      {showOperators ? (
        <button
          type="button"
          onClick={() => handleKeyPress("+")}
          className="h-12 sm:h-13 rounded-2xl bg-orange-500/10 text-orange-500 dark:bg-orange-500/20 dark:text-orange-400 font-bold text-xl ios-tap-active flex items-center justify-center border border-orange-500/20 active:bg-orange-500/30 transition-colors cursor-pointer"
        >
          +
        </button>
      ) : null}

      {/* Row 5: Action Row */}
      <div className="col-span-4 grid grid-cols-4 gap-2 pt-1">
        <button
          type="button"
          onClick={() => handleKeyPress("C")}
          className="h-12 rounded-2xl bg-ios-gray-5 dark:bg-ios-gray-dark4 text-ios-gray-1 dark:text-ios-gray-2 font-semibold text-sm ios-tap-active flex items-center justify-center transition-colors cursor-pointer"
        >
          清空
        </button>

        {hasOperator ? (
          <button
            type="button"
            onClick={() => handleKeyPress("=")}
            className="col-span-3 h-12 rounded-2xl bg-orange-500 text-white font-bold text-base shadow-ios-card ios-tap-active flex items-center justify-center transition-transform hover:brightness-105 active:scale-[0.98] cursor-pointer"
          >
            = 计算结果
          </button>
        ) : (
          <button
            type="button"
            onClick={handleConfirmClick}
            className="col-span-3 h-12 rounded-2xl bg-ios-blue text-white font-bold text-base shadow-ios-modal ios-tap-active flex items-center justify-center space-x-1.5 transition-transform hover:brightness-105 active:scale-[0.98] cursor-pointer"
          >
            <Check className="w-5 h-5 stroke-[2.5]" />
            <span>{confirmLabel}</span>
          </button>
        )}
      </div>
    </div>
  );
};
