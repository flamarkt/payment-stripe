<?php

use Illuminate\Database\Schema\Blueprint;
use Illuminate\Database\Schema\Builder;

return [
    'up' => function (Builder $schema) {
        $schema->table('flamarkt_carts', function (Blueprint $table) {
            $table->string('stripe_payment_intent_id')->nullable();
        });
    },
    'down' => function (Builder $schema) {
        $schema->table('flamarkt_carts', function (Blueprint $table) {
            $table->dropColumn('stripe_payment_intent_id');
        });
    },
];
