async function getNextNumber(tx, key, prefix) {
  const counter = await tx.counter.upsert({
    where: { key },
    update: {
      value: { increment: 1 }
    },
    create: {
      key,
      value: 1
    }
  });

  const numericPart = String(counter.value).padStart(6, '0');
  return `${prefix}${numericPart}`;
}

module.exports = { getNextNumber };
