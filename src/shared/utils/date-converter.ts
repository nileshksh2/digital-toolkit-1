// Date conversion utilities for API requests
export function convertStringDateToDate(dateString?: string): Date | undefined {
  if (!dateString) return undefined;
  
  const date = new Date(dateString);
  if (isNaN(date.getTime())) {
    throw new Error(`Invalid date string: ${dateString}`);
  }
  
  return date;
}

export function convertApiRequestDates<T extends Record<string, any>>(
  data: T,
  dateFields: (keyof T)[]
): T {
  const converted = { ...data };
  
  for (const field of dateFields) {
    if (converted[field] && typeof converted[field] === 'string') {
      converted[field] = convertStringDateToDate(converted[field] as string) as T[typeof field];
    }
  }
  
  return converted;
}

export function convertDatesForEpic<T extends Record<string, any>>(data: T): T {
  return convertApiRequestDates(data, ['start_date', 'end_date', 'due_date']);
}

export function convertDatesForStory<T extends Record<string, any>>(data: T): T {
  return convertApiRequestDates(data, ['start_date', 'due_date']);
}

export function convertDatesForTask<T extends Record<string, any>>(data: T): T {
  return convertApiRequestDates(data, ['start_date', 'due_date']);
}

export function convertDatesForSubtask<T extends Record<string, any>>(data: T): T {
  return convertApiRequestDates(data, ['start_date', 'due_date']);
}