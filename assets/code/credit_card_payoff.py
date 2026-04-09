import tkinter as tk
from tkinter import messagebox, ttk

class CreditCardPayoffApp:
    def __init__(self, root):
        self.root = root
        self.root.title("Credit Card Payoff Calculator")

        self.cards = []
        self.card_frame = tk.Frame(root)
        self.card_frame.pack(pady=10)

        self.add_card_ui()
        self.total_payment_ui()

        self.result_text = tk.Text(root, height=15, width=80)
        self.result_text.pack(pady=10)

        self.breakdown_text = tk.Text(root, height=20, width=80)
        self.breakdown_text.pack(pady=10)

    def add_card_ui(self):
        headers = ["Card Name", "Balance ($)", "Interest Rate (%)", "Custom Payment (optional)"]
        for i, text in enumerate(headers):
            tk.Label(self.card_frame, text=text).grid(row=0, column=i)

        self.entries = []
        preset_cards = [
            {"name": "Best Buy", "balance": "1300", "interest": "0"},
            {"name": "BOFA", "balance": "4954", "interest": "21.24"},
            {"name": "chase", "balance": "3493", "interest": "28.24"},
            {"name": "amazon", "balance": "1192", "interest": "29.99"},
        ]
        for card in preset_cards:
            self.add_card_row(card['name'], card['balance'], card['interest'], "")

        self.add_button = tk.Button(self.card_frame, text="+ Add Card", command=self.add_card_row)
        self.add_button.grid(row=len(self.entries) + 1, column=4)

    def add_card_row(self, name="", balance="", interest="", custom_payment=""):
        row = len(self.entries) + 1
        name_e = tk.Entry(self.card_frame)
        balance_e = tk.Entry(self.card_frame)
        interest_e = tk.Entry(self.card_frame)
        payment_e = tk.Entry(self.card_frame)

        name_e.grid(row=row, column=0, padx=5, pady=2)
        balance_e.grid(row=row, column=1, padx=5)
        interest_e.grid(row=row, column=2, padx=5)
        payment_e.grid(row=row, column=3, padx=5)

        name_e.insert(0, name)
        balance_e.insert(0, balance)
        interest_e.insert(0, interest)
        payment_e.insert(0, custom_payment)

        self.entries.append((name_e, balance_e, interest_e, payment_e))

    def total_payment_ui(self):
        frame = tk.Frame(self.root)
        frame.pack(pady=5)

        tk.Label(frame, text="Total Payment Amount ($):").pack(side=tk.LEFT)
        self.total_payment_entry = tk.Entry(frame)
        self.total_payment_entry.pack(side=tk.LEFT, padx=5)

        tk.Label(frame, text="Strategy:").pack(side=tk.LEFT, padx=(20, 0))
        self.strategy = ttk.Combobox(frame, values=["Avalanche", "Snowball"], state="readonly")
        self.strategy.current(0)
        self.strategy.pack(side=tk.LEFT, padx=5)

        self.calculate_button = tk.Button(frame, text="Calculate Payments", command=self.calculate)
        self.calculate_button.pack(side=tk.LEFT)

    def calculate(self):
        try:
            cards = []
            for name_e, bal_e, int_e, pay_e in self.entries:
                name = name_e.get()
                if not name:
                    continue
                balance = float(bal_e.get())
                interest = float(int_e.get())
                custom = pay_e.get()
                custom_payment = float(custom) if custom else None
                cards.append({
                    'name': name,
                    'balance': balance,
                    'interest': interest,
                    'custom_payment': custom_payment,
                })

            total_payment = float(self.total_payment_entry.get())
        except ValueError:
            messagebox.showerror("Invalid Input", "Please enter valid numbers.")
            return

        results, breakdown = self.simulate_dynamic_payoff(cards, total_payment)
        self.display_results(results)
        self.display_breakdown(breakdown)

    def simulate_dynamic_payoff(self, cards, total_payment):
        strategy = self.strategy.get()
        sort_key = (lambda x: x['interest']) if strategy == "Avalanche" else (lambda x: x['balance'])

        month = 0
        history = {card['name']: {'months': 0, 'paid_off': False} for card in cards}
        balances = {card['name']: card['balance'] for card in cards}
        interest_rates = {card['name']: card['interest'] for card in cards}
        custom_payments = {card['name']: card['custom_payment'] for card in cards}
        breakdown = []

        while any(balances[name] > 0 for name in balances) and month < 1000:
            month += 1
            monthly_log = {"Month": month, "Payments": {}}
            unpaid_cards = [c for c in cards if balances[c['name']] > 0]
            unpaid_cards.sort(key=sort_key, reverse=True)

            available = total_payment

            # Step 1: Apply custom or minimum payments to all cards
            for card in unpaid_cards:
                name = card['name']
                balance = balances[name]
                if balance <= 0:
                    continue

                if custom_payments[name] is not None:
                    pay = min(custom_payments[name], balance)
                else:
                    pay = max(25, balance * 0.02)

                pay = min(pay, available)
                balances[name] = self.apply_interest_and_payment(balance, interest_rates[name], pay)
                available -= pay
                monthly_log["Payments"][name] = round(pay, 2)

                if balances[name] <= 0 and not history[name]['paid_off']:
                    history[name]['months'] = month
                    history[name]['paid_off'] = True

            # Step 2: Apply remaining money to priority card
            for card in unpaid_cards:
                name = card['name']
                if available <= 0:
                    break
                if balances[name] <= 0:
                    continue
                if custom_payments[name] is not None:
                    continue

                extra = min(balances[name], available)
                balances[name] = max(0, balances[name] - extra)
                available -= extra
                monthly_log["Payments"][name] = round(monthly_log["Payments"].get(name, 0) + extra, 2)

                if balances[name] <= 0 and not history[name]['paid_off']:
                    history[name]['months'] = month
                    history[name]['paid_off'] = True

            breakdown.append(monthly_log)

        for card in cards:
            card['months_to_payoff'] = history[card['name']]['months'] if history[card['name']]['paid_off'] else "∞"
            card['final_payment'] = custom_payments[card['name']] if custom_payments[card['name']] else "Varies"

        return cards, breakdown

    def apply_interest_and_payment(self, balance, annual_rate, payment):
        monthly_rate = annual_rate / 12 / 100
        interest = balance * monthly_rate
        balance = balance + interest - payment
        return max(balance, 0)

    def display_results(self, cards):
        self.result_text.delete(1.0, tk.END)
        for card in cards:
            self.result_text.insert(
                tk.END,
                f"{card['name']}:\n"
                f"  → Est. Payoff Time: {card['months_to_payoff']} months\n"
                f"  → Payment: ${card['final_payment']}\n\n"
            )

    def display_breakdown(self, breakdown):
        self.breakdown_text.delete(1.0, tk.END)
        for month in breakdown:
            self.breakdown_text.insert(tk.END, f"Month {month['Month']}:\n")
            for name, amount in month["Payments"].items():
                self.breakdown_text.insert(tk.END, f"  → {name}: ${amount:.2f}\n")
            self.breakdown_text.insert(tk.END, "\n")

# Run the app
if __name__ == "__main__":
    root = tk.Tk()
    app = CreditCardPayoffApp(root)
    root.mainloop()
