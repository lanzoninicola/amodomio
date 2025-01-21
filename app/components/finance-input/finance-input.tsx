import { useState } from "react";
import { cn } from "~/lib/utils";

interface FinanceInputProps {
    inputValue: string;
    label?: string;
    name?: string;
    placeholder?: string;
    onChange?: (value: string) => void; // Callback to pass the database-compatible value
    className?: string
}

const FinanceInput = ({ inputValue, label, name, onChange, placeholder, className }: FinanceInputProps) => {
    const [value, setValue] = useState(inputValue || "0.00");
    const [error, setError] = useState("");

    // Helper to validate Brazilian currency format
    const validate = (value: string) => {
        if (value.indexOf(",") > -1) {
            return {
                isValid: false,
                errorMessage: "Use o ponto para separar os centavos",
            };
        }

        return {
            isValid: true,
            errorMessage: "",
        }

    };


    // Handle user input change
    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const inputValue = e.target.value;

        const sanitizedValue = inputValue.trim();
        const validationResult = validate(sanitizedValue);

        if (validationResult.isValid) {
            setError("");
            setValue(sanitizedValue);

            // Pass the transformed value to the parent component or handler
            if (onChange) {
                onChange(sanitizedValue);
            }
        } else {
            setError(validationResult.errorMessage);
        }
    };

    const handleBlur = () => {
        if (!validate(value)) {
            setError("O valor inserido não é válido.");
        }
    };

    return (
        <div className={className}>
            <label
                htmlFor={name || "finance-input"}
                className={cn(
                    "block text-sm font-medium text-gray-700 mb-2",
                    !label && "hidden"
                )}
            >
                {label || "Valor"}
            </label>
            <input
                name={name || "finance-input"}
                type="text"
                placeholder={placeholder}
                value={value}
                onChange={handleChange}
                onBlur={handleBlur}
                className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 ${error
                    ? "border-red-500 focus:ring-red-400"
                    : "border-gray-300 focus:ring-blue-500"
                    }`}
            />
            {error && <p className="text-red-500 text-[11px] font-semibold mt-2 leading-tight">{error}</p>}
        </div>
    );
};

export default FinanceInput;