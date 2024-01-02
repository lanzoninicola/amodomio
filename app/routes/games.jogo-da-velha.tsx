import React, { useState, useEffect } from 'react';

type Player = 'X' | 'O';
type Board = Player[];

const initialBoard: Board = Array(9).fill(null);

const calculateWinner = (squares: Board): Player | null => {
    const lines = [
        [0, 1, 2], [3, 4, 5], [6, 7, 8],
        [0, 3, 6], [1, 4, 7], [2, 5, 8],
        [0, 4, 8], [2, 4, 6]
    ];

    for (const [a, b, c] of lines) {
        if (squares[a] && squares[a] === squares[b] && squares[a] === squares[c]) {
            return squares[a];
        }
    }

    return null;
};

const Square: React.FC<{ value: Player | null, onClick: () => void }> = ({ value, onClick }) => (
    <button className="w-16 h-16 text-xl bg-white border border-gray-400 flex items-center justify-center hover:bg-gray-100 cursor-pointer" onClick={onClick}>
        {value}
    </button>
);

const App: React.FC = () => {
    const [history, setHistory] = useState<Board[]>([initialBoard]);
    const [step, setStep] = useState(0);
    const [isXNext, setIsXNext] = useState(true);
    const current = history[step];
    const winner = calculateWinner(current);

    const handleClick = (i: number) => {
        if (winner || current[i] || !isXNext) {
            return;
        }

        const newBoard = current.slice();
        newBoard[i] = 'X';

        setHistory(history.slice(0, step + 1).concat([newBoard]));
        setStep(step + 1);
        setIsXNext(false);
    };

    useEffect(() => {
        if (!isXNext && !winner && current.every(square => square !== null)) {
            const computerMove = current.slice();
            let moveMade = false;

            while (!moveMade) {
                const randomIndex = Math.floor(Math.random() * 9);

                if (computerMove[randomIndex] === null) {
                    computerMove[randomIndex] = 'O';
                    moveMade = true;
                }
            }

            setTimeout(() => {
                setHistory(history.concat([computerMove]));
                setStep(step + 1);
                setIsXNext(true);
            }, 1000);
        }
    }, [isXNext, current, history, step, winner]);

    return (
        <div className="flex">
            <div className="mr-8">
                <div>
                    {winner ? `Winner: ${winner}` : (current.every(square => square !== null) ? 'It\'s a draw!' : (isXNext ? 'Next player: X' : 'The computer is thinking...'))}
                </div>
            </div>
            <div className="grid grid-cols-3 grid-rows-3">
                {current.map((square, i) => (
                    <Square key={i} value={square} onClick={() => handleClick(i)} />
                ))}
            </div>
        </div>
    );
};

export default App;
