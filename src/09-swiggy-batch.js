/**
 * 🍔 Swiggy Batch Delivery System - Promise.all, Promise.race, Promise.allSettled
 *
 * Swiggy ka batch delivery system banana hai jahan multiple orders ek saath
 * handle hote hain. Promise.all se sab orders ek saath process karo,
 * Promise.race se pehla ready order pakdo, aur Promise.allSettled se
 * mixed results handle karo. Har ek ka apna use case hai!
 *
 * Function: prepareOrder(item, prepTime)
 *   - Returns a new Promise
 *   - Resolves after prepTime milliseconds with:
 *     { item, ready: true, prepTime }
 *   - If item is empty/null/undefined: reject with Error "Item name required!"
 *   - If prepTime <= 0 or not a number: reject with Error "Invalid prep time!"
 *   - Use setTimeout for the delay
 *
 * Function: prepareBatch(items)
 *   - Takes array of { name, prepTime } objects
 *   - Uses Promise.all to prepare ALL items simultaneously
 *   - Calls prepareOrder(item.name, item.prepTime) for each
 *   - Returns Promise resolving with array of prepared items
 *   - If ANY single item fails, the ENTIRE batch fails (Promise.all behavior)
 *   - If items array is empty, resolve with empty array
 *
 * Function: getFirstReady(items)
 *   - Takes array of { name, prepTime } objects
 *   - Uses Promise.race to get the FIRST item that's ready
 *   - Returns Promise resolving/rejecting with the first settled Promise
 *   - If items array is empty, reject with Error "No items to prepare!"
 *
 * Function: prepareSafeBatch(items)
 *   - Takes array of { name, prepTime } objects
 *   - Uses Promise.allSettled to handle ALL outcomes
 *   - Returns Promise resolving with array of results:
 *     Each: { status: "fulfilled", value: preparedItem }
 *     Or:   { status: "rejected", reason: errorMessage }
 *   - Never rejects — always resolves with full results array
 *   - If items array is empty, resolve with empty array
 *
 * Function: deliverWithTimeout(orderPromise, timeoutMs)
 *   - Takes a Promise (orderPromise) and timeout in milliseconds
 *   - Uses Promise.race between orderPromise and a timeout
 *   - If orderPromise resolves first: returns the result
 *   - If timeout fires first: rejects with Error "Delivery timeout!"
 *   - timeoutMs must be > 0, otherwise reject with Error "Invalid timeout!"
 *
 * Function: batchWithRetry(items, maxRetries)
 *   - Tries prepareBatch(items)
 *   - If it fails, retries up to maxRetries times
 *   - Returns result of first successful attempt
 *   - If all attempts fail, throws the last error
 *   - maxRetries must be >= 0 (0 means no retries, just one attempt)
 *   - Each retry is a fresh call to prepareBatch
 *
 * Rules:
 *   - Use Promise.all for prepareBatch (all-or-nothing)
 *   - Use Promise.race for getFirstReady and deliverWithTimeout
 *   - Use Promise.allSettled for prepareSafeBatch (never fails)
 *   - prepareOrder must use actual setTimeout for delays
 *   - batchWithRetry uses sequential retry logic
 *   - Empty arrays should be handled gracefully
 *
 * @example
 *   const item = await prepareOrder("Biryani", 200);
 *   // => { item: "Biryani", ready: true, prepTime: 200 }
 *
 * @example
 *   const batch = await prepareBatch([
 *     { name: "Dosa", prepTime: 100 },
 *     { name: "Idli", prepTime: 50 }
 *   ]);
 *   // => [{ item: "Dosa", ready: true, prepTime: 100 },
 *   //     { item: "Idli", ready: true, prepTime: 50 }]
 *
 * @example
 *   const first = await getFirstReady([
 *     { name: "Dosa", prepTime: 200 },
 *     { name: "Maggi", prepTime: 50 }
 *   ]);
 *   // => { item: "Maggi", ready: true, prepTime: 50 }  (pehle ready hua!)
 *
 * @example
 *   const results = await prepareSafeBatch([
 *     { name: "Pizza", prepTime: 100 },
 *     { name: "", prepTime: 50 }  // invalid item
 *   ]);
 *   // => [{ status: "fulfilled", value: {...} },
 *   //     { status: "rejected", reason: "Item name required!" }]
 */
export function prepareOrder(item, prepTime) {
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      if (!item) {
        reject(new Error("Item name required!"));
      }
      if (typeof prepTime !== "number" || prepTime <= 0) {
        reject(new Error("Invalid prep time!"));
      }
      resolve({ item, ready: true, prepTime });
    }, prepTime);
  });
}

export function prepareBatch(items) {
  items = items.map((item) => prepareOrder(item.name, item.prepTime));
  return Promise.all(items);
}

export function getFirstReady(items) {
  items = items.map((order) => prepareOrder(order.name, order.prepTime));
  return new Promise((resolve, reject) => {
    if (!items.length) {
      reject(new Error("No items to prepare!"));
    } else {
      resolve(Promise.race(items));
    }
  });
}

export function prepareSafeBatch(items) {
  function modifiedPrepareOrder(order) {
    return new Promise(async (resolve, reject) => {
      try {
        const value = await prepareOrder(order.name, order.prepTime);
        resolve(value);
      } catch (error) {
        reject(error.message);
      }
    });
  }
  items = items.map((order) => modifiedPrepareOrder(order));
  return new Promise((resolve, reject) => {
    if (!items.length) {
      resolve([]);
    } else {
      resolve(Promise.allSettled(items));
    }
  });
}

export function deliverWithTimeout(orderPromise, timeoutMs) {
  const rejectionTimer = new Promise((_, reject) =>
    setTimeout(() => {
      reject(new Error("Delivery timeout!"));
    }, timeoutMs)
  );

  rejectionTimer.catch(() => {}); // why catch what if it is removed ? Very important concept

  return new Promise((resolve, reject) => {
    if (timeoutMs <= 0) {
      reject(new Error("Invalid timeout!"));
    } else {
      resolve(Promise.race([orderPromise, rejectionTimer]));
    }
  });
}

export async function batchWithRetry(items, maxRetries) {
  if (maxRetries < 0) {
    throw new Error("Invalid number of retries");
  }

  let attempts = maxRetries > 0 ? maxRetries + 1 : 1;
  let lastError;
  while (attempts > 0) {
    attempts--;
    try {
      let results = await prepareBatch(items);
      return results;
    } catch (error) {
      lastError = error;
    }
  }
  throw new Error(lastError.message);
}
