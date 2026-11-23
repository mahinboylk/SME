import { createContext, useContext, useEffect, useState, useCallback } from 'react';

export interface CartItem {
  listingId: string;
  title: string;
  description?: string | null;
  price: number | null;
  currency: string;
  quantity: number;
  category?: string | null;
  sellerName?: string | null;
}

interface CartContextType {
  items: CartItem[];
  addItem: (item: Omit<CartItem, 'quantity'> & { quantity?: number }) => void;
  removeItem: (listingId: string) => void;
  updateQuantity: (listingId: string, quantity: number) => void;
  clearCart: () => void;
  totalItems: number;
  totalAmount: (forexRate?: number) => number;
}

const CartContext = createContext<CartContextType | null>(null);
const STORAGE_KEY = 'brooke_cart';

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<CartItem[]>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) return JSON.parse(raw) as CartItem[];
    } catch {
      // ignore
    }
    return [];
  });

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    } catch {
      // ignore
    }
  }, [items]);

  const addItem = useCallback((item: Omit<CartItem, 'quantity'> & { quantity?: number }) => {
    setItems((prev) => {
      const existing = prev.find((p) => p.listingId === item.listingId);
      if (existing) {
        return prev.map((p) => p.listingId === item.listingId ? { ...p, quantity: p.quantity + (item.quantity ?? 1) } : p);
      }
      return [...prev, { ...item, quantity: item.quantity ?? 1 }];
    });
  }, []);

  const removeItem = useCallback((listingId: string) => {
    setItems((prev) => prev.filter((p) => p.listingId !== listingId));
  }, []);

  const updateQuantity = useCallback((listingId: string, quantity: number) => {
    if (quantity <= 0) {
      setItems((prev) => prev.filter((p) => p.listingId !== listingId));
      return;
    }
    setItems((prev) => prev.map((p) => p.listingId === listingId ? { ...p, quantity } : p));
  }, []);

  const clearCart = useCallback(() => setItems([]), []);

  const totalItems = items.reduce((sum, i) => sum + i.quantity, 0);

  const totalAmount = useCallback((forexRate = 300) => {
    return items.reduce((sum, i) => {
      if (i.price == null) return sum;
      // Normalize to LKR for displaytotal; Stripe will be in USD cents or LKR
      const priceLkr = i.currency === 'USD' ? i.price * forexRate : i.price;
      return sum + priceLkr * i.quantity;
    }, 0);
  }, [items]);

  return (
    <CartContext.Provider value={{ items, addItem, removeItem, updateQuantity, clearCart, totalItems, totalAmount }}>
      {children}
    </CartContext.Provider>
  );
}

export function useCart(): CartContextType {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart must be used within CartProvider');
  return ctx;
}
