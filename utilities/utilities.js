exports.isNill = (value) => {
  return value === null || value === undefined;
};


/*
^[6-9]: The number must start with 6, 7, 8, or 9.
\d{9}$: Followed by 9 more digits (total 10 digits).
^ and $: Ensure the number matches the entire string.
*/
exports.checkForValidIndianNumber = (number) => {
  const regex = /^[6-9]\d{9}$/;
  return regex.test(number);
};

