export interface Product {
    id: string;
    name: string;
    unitCost: number;
  }
  
export interface Cart {
    [key: string]: number; 
    additionalCharges: number;
}

export type LogLevel = 'info' | 'warning' | 'error' | 'success';
